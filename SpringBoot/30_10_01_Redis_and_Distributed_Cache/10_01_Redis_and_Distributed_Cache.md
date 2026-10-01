# Redis와 분산 캐시: 여러 서버의 조회 결과 공유와 일관성 경계

- 🎯 글의 목표: 로컬 캐시와 공유 캐시의 차이를 설명하고, Spring Boot의 Redis 연결·직렬화·TTL·무효화 설정과 장애 시 판단 기준을 읽을 수 있다.
- 🧩 핵심 키워드: Redis, RedisCacheManager, Lettuce, Serialization, Key Prefix, TTL, Cache-aside, After Commit, Cache Stampede
- ⭐ 중요도: ★★★★★ — 서버가 늘면 캐시의 위치뿐 아니라 네트워크 장애·데이터 형식·변경 반영 범위도 설계해야 한다.
- 📝 한눈에 보는 내용: 두 서버의 로컬 캐시가 달라지는 문제에서 출발한다. Redis 명령과 Spring 설정을 연결하고, 문자열 조회 예제·공유 캐시 테스트로 키·만료·삭제를 살펴본 뒤 commit·동시 miss·장애·운영 기준을 정리한다.
- 🔗 관련 주제: [이전 노트 — Spring Cache·Caffeine](../29_09_30_Spring_Cache_and_Caffeine/09_30_Spring_Cache_and_Caffeine.md), [트랜잭션과 rollback](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md), [Transactional Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md), [Bulkhead·Rate Limiter](../28_09_29_Bulkhead_and_Rate_Limiting/09_29_Bulkhead_and_Rate_Limiting.md)
- 🧱 선수 지식: 캐시 hit/miss·키·프록시 호출, Java 생성자 주입·예외, DB commit·rollback

> 기준일: 2026-10-01. Java 21의 기존 Boot 실습 프로젝트에 추가하는 파일·일부 설정이다. 조사한 Boot Reference는 4.1.1, Spring Data Redis Reference는 4.1.1, 확인 가능한 current API 문서 표시는 4.1.0이다. 의존성은 프로젝트의 Boot 관리 버전으로 맞추고, 아래 API는 확인한 4.1 계열 계약을 기준으로 한다. Redis 실행 명령은 7.4 계열의 로컬 실습 예시이며 최신 버전이라는 뜻이 아니다. 현재 PATH에서 Java·javac·Maven·Gradle·Docker를 찾지 못해 컴파일·Redis 실행·JUnit·다중 서버 검증은 수행하지 않았다. 결과 설명은 예상 동작이다.

## 1. 들어가며

서버 A와 B가 각자 Caffeine에 상품 이름을 보관한다고 생각해 보자. A에서 이름을 바꾸고 A의 캐시를 비웠지만, B에는 이전 이름이 남아 있을 수 있다. 요청이 어느 서버로 가느냐에 따라 화면이 다르게 보이는 이유다.

이번에는 두 서버가 **같은 Redis의 같은 키를 읽는 공유 캐시**를 배운다. 이전 노트의 Spring Cache 규칙을 유지하면서 보관 위치를 서버 프로세스 밖으로 옮기는 것이다. 그러나 공유된다는 사실만으로 DB와 캐시가 동시에 바뀌거나 모든 장애가 해결되지는 않는다.

핵심 질문은 “무엇이 공유되고 어떤 실패 구간이 남는가?”다. Redis의 모든 자료구조나 Cluster 구축보다, 상품 이름 조회를 연결하는 데 필요한 키·직렬화·TTL·commit 후 삭제·장애 정책에 집중한다.

## 2. 핵심 개념 정리

```text
서버 A의 Spring 캐시 프록시 ─┐
                            ├─ 네트워크 → 같은 Redis의 같은 키
서버 B의 Spring 캐시 프록시 ─┘                ├─ hit  → 저장값 반환
                                             └─ miss → 원본 DB 조회 → 캐시 기록

원본 DB 변경 commit → Redis 키 삭제 → 다음 요청에서 원본 재조회
                   └─ commit 이후 삭제 실패·동시 로딩은 별도 검토
```

도식은 두 서버가 동일한 원본 DB와 Redis를 사용하고, 추가 로컬 캐시는 두지 않은 경우다. 서로 다른 DB를 읽거나 다른 키 공간을 사용하면 보관 서버만 같아도 같은 결과를 공유하지 못한다.

| 질문 | 확인할 경계 | 본문 |
| --- | --- | --- |
| 값이 어느 프로세스에 있는가? | 로컬 메모리·네트워크 저장소 | 3.1 |
| 어떤 값이 어떤 이름으로 기록되는가? | Redis 명령·TTL·키·직렬화 | 3.2–3.3 |
| Spring은 어떻게 연결하는가? | 의존성·연결·관리자·조회 Service | 3.4–3.5 |
| DB 변경을 언제 반영하는가? | 트랜잭션·무효화 실패·재삽입 | 3.6 |
| 동시에 비거나 접근에 실패하면? | 로딩 경쟁·오류 정책·원본 보호 | 3.7–3.8 |
| 무엇으로 효과와 정확성을 확인하는가? | 메모리·삭제 범위·공유 테스트 | 3.9–3.10 |

## 3. 본문 정리

### 3.1 Redis는 프로세스 밖에서 접근하는 키 기반 저장소다

**Redis**는 키로 값을 읽고 쓰며 다양한 자료구조를 제공하는 저장소다. 이번 노트는 그중 문자열 값을 캐시로 사용하는 경우를 다룬다. 캐시는 Redis의 사용 목적 중 하나이지 Redis 전체와 같은 뜻은 아니다. [Boot Redis 소개](https://docs.spring.io/spring-boot/reference/data/nosql.html#data.nosql.redis)

**분산 캐시**는 여러 애플리케이션 인스턴스가 네트워크를 통해 이용하는 캐시를 말한다. 여기서 인스턴스는 따로 실행 중인 서버 프로세스다. 단일 Redis 서버를 여러 앱이 공유하는 학습 구성과 Redis 자체의 복제·분할 구성은 구분해야 한다. 보관 위치가 밖에 있다는 이유만으로 고가용성까지 준비된 것은 아니다.

| 비교 기준 | Caffeine 로컬 캐시 | 이 노트의 공유 Redis 캐시 |
| --- | --- | --- |
| 값의 위치 | 각 JVM의 메모리 | 별도 Redis 서버 |
| 접근 경로 | 프로세스 내부 | 연결·명령·응답을 통한 네트워크 접근 |
| 앱 재시작 | 해당 프로세스의 값 소멸 | Redis가 유지되면 앱 재시작만으로는 값이 사라지지 않음 |
| 한 키 삭제 | 그 로컬 캐시만 영향 | 같은 Redis·같은 키를 읽는 호출에 영향 |
| 추가로 생각할 문제 | 프로세스별 값 차이·메모리 | 연결 장애·지연·직렬화·공유 저장소 용량 |

표는 이번 두 구성의 비교다. Redis의 재시작·복구 시 캐시가 남는지는 별도 영속화 설정에 달려 있다. 운영에서 없어져도 재생성할 캐시와 반드시 보존할 업무 데이터는 저장 목적부터 분리한다.

### 3.2 SET·GET·TTL로 저장과 만료를 먼저 읽는다

**키(key)**는 찾을 주소이고 **값(value)**은 그 주소에 보관할 내용이다. 문자열 캐시에서는 이름을 값으로 저장할 수 있다. **TTL(Time To Live)**은 이 항목을 유효하게 둘 시간으로, 같은 값을 오래 재사용하지 않도록 제한한다.

아래는 **학습용 전용 Redis가 이미 실행 중일 때 사용하는 PowerShell 명령**이다. `redis-cli`는 Redis 명령을 보내는 클라이언트다. 설치·Docker 준비 방법은 3.4에 이어서 설명한다. 이 명령은 운영 서버가 아닌 `127.0.0.1:6379`의 실습 대상에만 사용한다.

```powershell
redis-cli -h 127.0.0.1 -p 6379 SET til:learning:manual:name:1 "keyboard" EX 30 # 이름과 30초 만료를 한 명령으로 기록한다.
redis-cli -h 127.0.0.1 -p 6379 GET til:learning:manual:name:1 # 만료 전이면 저장된 이름을 읽는다.
redis-cli -h 127.0.0.1 -p 6379 TTL til:learning:manual:name:1 # 이 키의 남은 유효 시간을 초 단위로 확인한다.
```

첫 명령이 성공하면 `OK`를 받고, 다음 조회는 만료 전이면 `keyboard`를 반환한다. TTL은 실행까지 흐른 시간에 따라 달라지므로 정확히 30이라고 고정하지 않는다. `-1`은 키는 있지만 만료가 없다는 뜻이고, `-2`는 키가 없다는 뜻이다. [SET 옵션](https://redis.io/docs/latest/commands/set/), [TTL 반환값](https://redis.io/docs/latest/commands/ttl/)

`SET`과 만료 설정을 따로 하면 그 사이 실패해 만료 없는 키가 남을 수 있다. 위 예시는 값과 만료를 같이 전달한다. 또 기존 키에 평범한 `SET`만 다시 실행하면 이전 TTL이 사라질 수 있으므로, “이미 TTL이 있던 키”라는 이유로 만료 옵션을 생략하지 않는다.

**TTI(Time To Idle)**는 마지막 접근 이후의 유휴 시간을 기준으로 하는 정책이다. Spring Redis 캐시의 TTI 옵션은 읽을 때 TTL을 갱신하는 방식이고 Redis 6.2 이상의 `GETEX` 지원 등이 필요하다. 이번 예제는 TTI를 켜지 않으므로 일반 조회만으로 TTL을 연장하지 않는다. [Spring Redis TTL·TTI 구분](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html#redis-cache-expiration)

### 3.3 공유 키에는 환경·캐시 이름·데이터 형식의 경계가 필요하다

**Prefix(접두사)**는 키 앞의 공통 문자열이다. 개발·운영 또는 서로 다른 앱이 같은 저장소를 사용하면 상품 ID만으로는 충돌할 수 있다. 아래는 작성한 키 설계 예시다.

```text
til:learning:v1:productNames::1
└─ 앱·학습 환경·형식 버전 └─ 캐시 이름 └─ 상품 ID
```

같은 Redis라도 prefix가 다르면 다른 키다. 언어·회사별로 결과가 달라지는 서비스에서는 이전 노트처럼 해당 조건도 키에 넣는다. prefix는 이름 구분이지 접근 권한이나 자원 격리가 아니므로 보안 통제로 대신하지 않는다.

**직렬화(serialization)**는 Java 값 등을 저장·전송할 바이트로 바꾸는 과정이고, **역직렬화(deserialization)**는 그 바이트를 다시 값으로 읽는 과정이다. Caffeine에 Java 객체 참조를 두는 것과 달리 네트워크를 건너려면 표현 형식이 필요하다. 이 노트는 UTF-8 문자열을 사용한다. UTF-8은 한글 등을 바이트로 표현하는 문자 인코딩이며, `StringRedisSerializer`는 문자열과 바이트를 서로 변환한다. [문자열 serializer API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/serializer/StringRedisSerializer.html)

Spring Redis 캐시의 기본 값 serializer를 “JSON이겠지”라고 추측하지 않는다. 확인한 기본 설정은 JDK 직렬화이며, 아래 코드에서는 값도 문자열로 명시한다. `RedisTemplate`에 serializer를 설정했다고 `RedisCacheManager`의 serializer도 자동으로 같아지는 것은 아니다. 각각의 사용 경로를 확인한다. [RedisCacheConfiguration 기본값](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheConfiguration.html), [RedisTemplate 직렬화](https://docs.spring.io/spring-data/redis/reference/redis/template.html#redis:serializer)

⚠️ 주의: 문자열 전용 캐시에 DTO·Entity를 넣지 않는다. 형식을 바꾸려면 양쪽 서버의 읽기·쓰기 계약과 배포 호환성을 정해야 한다. JSON DTO로 확장하더라도 필드 변경·serializer 버전·역직렬화 실패를 검증하고, 필요하면 새 prefix로 분리한다. 이전 prefix의 키는 TTL 또는 계획된 정리로 관리한다.

### 3.4 연결 설정과 학습용 Redis를 준비한다

다음은 Boot 플러그인과 의존성 관리가 있는 **Gradle Groovy 프로젝트에 추가하는 일부 설정**이다. 기존 `dependencies` 블록에 합친다. 이번 경로만 실습한다면 이전 Caffeine 의존성·`spring.cache.type: caffeine`·Caffeine 전용 설정은 제거하거나 별도 Profile로 분리한다.

```groovy
dependencies { // 기존 프로젝트의 의존성 블록에 합친다.
    implementation 'org.springframework.boot:spring-boot-starter-cache' // Spring 캐시 애너테이션과 관리자 연결을 지원한다.
    implementation 'org.springframework.boot:spring-boot-starter-data-redis' // Redis 연결과 Spring Data Redis를 가져온다.
    testImplementation 'org.springframework.boot:spring-boot-starter-test' // 3.10의 JUnit 검사에 사용할 의존성이다.
}
```

기본 클라이언트인 **Lettuce**는 Java에서 Redis 명령을 전달하는 라이브러리다. **RedisConnectionFactory**는 Redis 접근에 필요한 연결을 제공하는 Spring 추상화이며, Boot가 연결 속성을 읽어 구성한다. 버전은 Boot 관리에 맡긴다. [Boot Redis 연결](https://docs.spring.io/spring-boot/reference/data/nosql.html#data.nosql.redis.connecting)

**설정 위치:** `src/main/resources/application.yml`. 기존 `spring:` 아래에 합친다. 이 노트는 캐시 관리자를 Java에서 직접 만들므로 TTL·prefix를 YAML과 두 군데에 중복 설정하지 않는다.

```yaml
spring: # Spring Boot 설정 영역이다.
  data: # 저장 기술 관련 설정이다.
    redis: # 자동 구성할 Redis 연결의 정보다.
      host: 127.0.0.1 # 로컬 학습 서버에만 연결한다.
      port: 6379 # 해당 서버가 사용하는 포트다.
      connect-timeout: 1s # 연결 수립에 허용할 시간의 학습용 값이다.
      timeout: 500ms # 명령 응답 대기를 제한할 읽기 timeout의 학습용 값이다.
```

연결 timeout과 응답 대기는 서로 다른 구간이며, 위 숫자는 보편적 권장값이 아니다. 전체 요청 deadline·재시도·원본 조회 시간을 포함해 예산을 정한다. 사용자 정의 연결 팩토리를 등록하면 자동 구성과 속성 적용 경로도 달라질 수 있다. [연결 속성 정의](https://docs.spring.io/spring-boot/appendix/application-properties/index.html#application-properties.data.spring.data.redis.connect-timeout)

Windows에서 Docker가 준비되어 있다면 아래는 **학습용 실행 예시**다. Docker는 격리된 실행 환경인 컨테이너에서 프로그램을 실행하는 도구다. Linux 컨테이너 모드·빈 6379 포트·충돌 없는 컨테이너 이름을 먼저 확인한다. [Redis 공식 Docker 안내](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/)

```powershell
docker run --detach --name til-redis-learning --publish 127.0.0.1:6379:6379 redis:7.4 # Redis 7.4 계열 실습 컨테이너를 로컬 주소에만 노출한다.
docker exec til-redis-learning redis-cli PING # 정상 연결이면 PONG을 확인한다.
docker exec til-redis-learning redis-cli INFO server # 실제 실행된 redis_version을 기록한다.
```

위 명령은 이번 작업에서 실행하지 않았다. 로컬에 `redis-cli`가 없으면 3.2의 명령에서 `redis-cli -h 127.0.0.1 -p 6379` 부분을 `docker exec til-redis-learning redis-cli`로 바꾸어 컨테이너 내부 클라이언트를 사용한다. 이 구성은 운영용 인증·복제·백업·장애 복구 구성을 포함하지 않는다.

⚠️ 주의: 학습용 무인증 Redis를 인터넷에 노출하지 않는다. 운영에서는 네트워크 접근 제한·인증과 ACL·전송 보호를 구성하고, 비밀값을 Git에 넣지 않는다. ACL은 어떤 사용자에게 어떤 명령·키 접근을 허용할지 제한하는 기능이다. [Redis 보안 안내](https://redis.io/docs/latest/operate/oss_and_stack/management/security/)

### 3.5 RedisCacheManager와 문자열 조회 Service를 연결한다

**RedisCacheManager**는 Spring 캐시 작업을 Redis 저장소에 연결하는 관리자다. 이 예제에서는 TTL·prefix·serializer를 한 파일에서 읽을 수 있도록 직접 등록한다. 이전 `CacheConfiguration` 대신 아래 설정을 사용하고, 같은 역할의 관리자 Bean을 여러 개 만들어 선택을 모호하게 하지 않는다.

**추가 파일:** `src/main/java/com/example/rediscache/RedisCacheSettings.java`. `com.example` 아래가 컴포넌트 스캔 범위라는 전제다.

```java
package com.example.rediscache; // Redis 예제를 별도 패키지에 둔다.

import java.time.Duration; // TTL을 시간 단위로 표현한다.
import java.util.Set; // 미리 허용할 캐시 이름의 집합이다.
import org.springframework.cache.annotation.EnableCaching; // Bean 호출의 캐시 애너테이션 처리를 켠다.
import org.springframework.context.annotation.Bean; // 직접 구성한 관리자를 Bean으로 등록한다.
import org.springframework.context.annotation.Configuration; // Spring이 읽는 설정 파일로 표시한다.
import org.springframework.data.redis.cache.BatchStrategies; // 전체 캐시 삭제 시 사용할 탐색 전략이다.
import org.springframework.data.redis.cache.RedisCacheConfiguration; // TTL·prefix·serializer 계약을 구성한다.
import org.springframework.data.redis.cache.RedisCacheManager; // Spring Cache를 Redis에 연결한다.
import org.springframework.data.redis.cache.RedisCacheWriter; // 실제 Redis 읽기·쓰기·삭제를 수행한다.
import org.springframework.data.redis.connection.RedisConnectionFactory; // Boot가 구성한 연결 경계를 받는다.
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair; // 캐시가 사용할 변환 계약을 감싼다.
import org.springframework.data.redis.serializer.StringRedisSerializer; // 문자열과 UTF-8 바이트를 변환한다.

@Configuration(proxyBeanMethods = false) // 설정 메서드끼리 프록시 호출할 필요가 없다.
@EnableCaching // 아래 관리자를 캐시 애너테이션 처리에 사용한다.
public class RedisCacheSettings {
    @Bean // 자동 캐시 관리자 대신 이 명시적 관리자를 등록한다.
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        var strings = SerializationPair.fromSerializer(new StringRedisSerializer()); // 키·값 모두 문자열 인코딩으로 맞춘다.
        RedisCacheConfiguration defaults = RedisCacheConfiguration.defaultCacheConfig() // 기본 구성에서 필요한 정책을 바꾼다.
                .entryTtl(Duration.ofSeconds(30)) // 기록한 항목에 30초 만료를 적용한다.
                .prefixCacheNameWith("til:learning:v1:") // 환경·형식 버전을 캐시 이름 앞에 붙인다.
                .serializeKeysWith(strings) // 최종 Redis 키를 문자열 바이트로 기록한다.
                .serializeValuesWith(strings) // 이 관리자 아래 캐시는 String 값만 보관한다.
                .disableCachingNullValues(); // 부재를 null로 저장하는 정책은 사용하지 않는다.
        RedisCacheWriter writer = RedisCacheWriter.nonLockingRedisCacheWriter( // 전역 로딩 잠금이 없는 방식을 명시한다.
                connectionFactory, BatchStrategies.scan(1000)); // 전체 삭제 탐색은 SCAN 기반으로 한다.
        return RedisCacheManager.builder(writer) // 위 writer를 사용해 관리자를 구성한다.
                .cacheDefaults(defaults) // 등록할 캐시의 보관 정책이다.
                .initialCacheNames(Set.of("productNames")) // 실제 Redis 항목이 아니라 캐시 정의를 준비한다.
                .disableCreateOnMissingCache() // 이름 오타가 새 캐시를 만들지 못하게 한다.
                .transactionAware() // 활성 Spring 트랜잭션에 일반 put·evict를 맞춘다.
                .enableStatistics() // 이 관리자 인스턴스의 hit·miss 통계를 수집한다.
                .build(); // Spring이 초기화할 관리자 객체를 반환한다.
    }
}
```

관리자 구성과 항목 저장은 다르다. 캐시 이름을 초기화해도 상품 키는 첫 기록 때 생긴다. 위 prefix 정책과 상품 ID 1의 키를 합치면 `til:learning:v1:productNames::1`이 된다. 타입·TTL·null 정책은 configuration 계약이고, 이름 등록·트랜잭션 연동·통계는 manager 계약이다. [Configuration API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheConfiguration.html), [Manager builder API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html)

조회 원본은 별도 인터페이스로 둔다. **추가 파일:** `src/main/java/com/example/rediscache/ProductNameSource.java`.

```java
package com.example.rediscache; // 원본 접근의 계약을 캐시 설정과 분리한다.

public interface ProductNameSource { // 구현 Bean은 기존 DB 접근 계층에서 제공해야 한다.
    String load(long productId); // 존재하면 이름, 없으면 예외를 내며 null은 반환하지 않는 계약이다.
    void rename(long productId, String newName); // 같은 DB 트랜잭션에 참여하여 원본 이름을 수정한다.
}
```

**추가 파일:** `src/main/java/com/example/rediscache/ProductNameService.java`.

```java
package com.example.rediscache; // 캐시를 거치는 공개 Service 경계다.

import java.util.Objects; // 원본 구현의 null 계약 위반을 명시적으로 감지한다.
import org.springframework.cache.annotation.Cacheable; // 조회 결과 재사용을 선언한다.
import org.springframework.cache.annotation.CacheEvict; // 이름 변경 후 해당 조회 키를 삭제한다.
import org.springframework.stereotype.Service; // 다른 Bean이 주입받을 Service로 등록한다.
import org.springframework.transaction.annotation.Transactional; // 기존 DB 트랜잭션 관리자를 통해 수정 경계를 연다.

@Service // 외부 Bean이 주입받은 프록시를 호출해야 캐시·트랜잭션 처리가 적용된다.
public class ProductNameService {
    private final ProductNameSource source; // 실제 원본 DB 접근 구현을 보관한다.

    public ProductNameService(ProductNameSource source) { // 기존 데이터 접근 구현 Bean을 주입받는다.
        this.source = source; // 캐시 miss와 이름 변경에 사용할 경계다.
    }

    @Cacheable(cacheNames = "productNames", key = "#p0") // 동시 로딩 합치기를 지정하지 않고 첫 인자를 키로 사용한다.
    public String findName(long productId) { // 정상 반환 타입이 String이어서 위 serializer와 맞는다.
        return Objects.requireNonNull(source.load(productId), "원본 이름은 null일 수 없습니다."); // miss에서만 원본을 읽는다.
    }

    @Transactional // 기존 프로젝트의 DB transaction manager가 있어야 동작한다.
    @CacheEvict(cacheNames = "productNames", key = "#p0") // 성공한 변경에 연결해 같은 상품의 조회 결과를 비운다.
    public void rename(long productId, String newName) {
        if (newName == null || newName.isBlank()) { // 원본에 잘못된 값을 전달하기 전에 검사한다.
            throw new IllegalArgumentException("상품 이름은 비어 있을 수 없습니다."); // 실패하면 정상 변경 후 삭제로 취급하지 않는다.
        }
        source.rename(productId, newName); // DB 반영 시점은 연결된 트랜잭션의 commit에서 확정된다.
    }
}
```

`#p0`는 첫 인자다. 이 예제는 **기존 DB 구현 Bean·DataSource·트랜잭션 관리자가 필요한 추가 파일**이며, 인터페이스만 복사하면 애플리케이션이 완성되지는 않는다. [데이터 접근](../07_09_03_Data_Access_Fundamentals/09_03_Data_Access_Fundamentals.md)과 [트랜잭션 노트](../09_09_06_Transactions_and_Rollback/09_06_Transactions_and_Rollback.md)의 원본 접근 계층에 맞춰 구현해야 한다. 이전 노트의 프로세스별 메모리 Map을 두 서버의 공통 DB인 것처럼 사용하지 않는다.

만료·경쟁·장애가 없는 순차 실행에서 A의 첫 조회가 원본을 읽어 저장하면 B의 다음 조회는 같은 Redis 키에서 hit할 수 있다. 수정 후 삭제가 반영되면 다음 miss가 원본을 다시 읽는다. 직접 `new`로 Service를 만들거나 자기 메서드를 호출하면 프록시를 건너뛰는 문제는 Redis에서도 그대로 남는다.

### 3.6 transactionAware는 DB와 Redis를 하나의 commit으로 만들지 않는다

**Commit**은 DB 변경을 확정하는 것이고, **무효화**는 그 변경 때문에 더 이상 재사용하면 안 되는 캐시를 지우는 것이다. 변경된 값을 DB에서 읽기 전에 캐시만 먼저 비우면 다른 조회가 이전 DB 값을 다시 보관할 수 있다.

위 관리자의 `transactionAware()`는 활성 Spring 트랜잭션이 있을 때 일반 `put`·`evict`·`clear`를 성공한 after-commit 단계에 맞추는 장치다. after-commit은 DB 확정 이후를 뜻한다. 트랜잭션이 없으면 즉시 실행하고, 즉시 연산인 `putIfAbsent`·`evictIfPresent` 등까지 모두 지연하지는 않는다. [트랜잭션 연동 decorator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/transaction/TransactionAwareCacheDecorator.html)

일반 애너테이션 호출에서는 캐시 처리와 트랜잭션 처리가 어느 순서로 감싸지는지도 확인한다. 이 예제의 일반 삭제가 활성 트랜잭션 안에서 요청되면 commit 뒤로 맞추고, 트랜잭션 바깥에서 요청되면 그 시점에 수행한다. 그러므로 정상 반환과 바깥 트랜잭션의 최종 결과를 포함한 실제 경로로 검증해야 한다.

다음은 **분리된 두 저장소의 실패 구간을 설명하는 설계 시나리오**다.

| 실행 순서 | 상태 |
| --- | --- |
| DB 이름 변경 commit 성공 | 원본은 새 이름으로 확정됨 |
| Redis 삭제 요청 실패 | 기존 캐시가 남을 수 있음 |
| API에서 예외 관찰 | 이미 확정된 DB가 자동으로 rollback되지는 않음 |
| 후속 조회 | 만료·복구·삭제 재시도 전까지 오래된 값 가능 |

API 실패가 항상 “DB 변경 없음”을 뜻하지 않는 이유다. 재요청이 안전한지 기존 멱등성 기준을 적용하고, 캐시 삭제 실패를 관찰·복구할 정책을 둔다. TTL은 오래된 복사본의 수명을 제한하는 보완책이지 두 저장소의 원자적 commit이 아니다.

더 강한 전달 보장이 필요하면 [Outbox](../25_09_23_Transactional_Outbox_and_Event_Publishing/09_23_Transactional_Outbox_and_Event_Publishing.md)처럼 DB에 변경 사실을 함께 남기고 무효화 작업을 재시도하는 접근을 검토한다. 이것도 이벤트 지연·중복과 동시 읽기의 오래된 재삽입을 별도로 다뤄야 한다. 이 노트는 Outbox 기반 캐시 무효화를 구현하지 않았다.

⚠️ 주의: 읽기 R이 이전 값을 읽고, 쓰기 W가 commit·삭제한 뒤 R이 그 값을 다시 기록하는 경쟁은 공유 저장소에서도 검토해야 한다. prefix에 버전 문자열을 넣은 것만으로 데이터 변경 버전 경쟁이 해결되는 것도 아니다. 엄격한 최신성이 필요하면 해당 판단은 원본을 읽거나 데이터 버전·원자적 비교 등의 추가 설계를 검증한다.

### 3.7 Redis 공유와 분산 로딩 잠금은 다른 기능이다

**Cache stampede**는 비어 있거나 동시에 만료된 키 때문에 많은 요청이 원본에 몰리는 현상이다. A·B가 같은 Redis를 읽어도 두 요청이 동시에 miss를 보면 각자 원본을 읽을 수 있다. 보관 결과가 공유되는 것과 계산 실행을 한 번으로 합치는 것은 다르다.

이 예제는 non-locking writer를 명시하고 `sync=true`를 사용하지 않았다. 이전 Caffeine의 동일 키 로딩 정책을 Redis에 그대로 일반화하지 않는다. Redis writer의 로딩 동기화 계약도 잠금 구성 여부를 확인해야 한다. locking writer는 추가 명령과 대기를 만들고, 캐시 수준 잠금이라는 범위도 고려해야 한다. [RedisCacheWriter 로딩 API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheWriter.html), [writer의 잠금 범위](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)

작성한 적용 기준은 다음과 같다. 원본 호출 수를 따로 제한하고, 동시에 많은 키가 만료되지 않게 TTL 분산을 검토하며, 동일 키 로딩 합치기가 꼭 필요하면 범위·최대 대기·실패 후 재시도를 설계한다. TTL 분산은 부하 집중을 줄이는 후보이지 같은 키 경쟁을 완전히 없애는 보장이 아니다.

⚠️ 주의: 잠금용 키를 만들었다는 이유만으로 안전한 분산 잠금을 구현했다고 판단하지 않는다. 잠금 만료 후 이전 실행자가 계속 작업하는 경우, 소유자 확인 없는 해제, 오래된 결과 기록을 검토해야 한다. 분산 잠금의 구현·정확성 증명은 이번 노트 범위 밖이다.

### 3.8 Redis 실패를 miss와 구분하고 우회 부하를 계산한다

**Miss**는 정상적으로 캐시를 조회했지만 재사용할 값이 없는 것이다. Redis 연결 거부·timeout·역직렬화 실패는 조회 자체가 실패한 것으로 서로 다르다. Spring의 기본 `SimpleCacheErrorHandler`는 캐시 오류를 호출자에게 다시 던지며, 자동으로 모든 오류를 무시하고 DB로 넘어가는 정책은 아니다. [기본 오류 handler API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleCacheErrorHandler.html)

**Fail-open**은 캐시 실패 때 제한된 조건으로 원본 조회를 계속하는 정책이고, **fail-closed**는 기능을 실패시키는 정책이다. 아래는 특정 오류 handler 구현이 아닌 설계 선택의 예시다.

| 상황 | 검토할 동작 | 같이 필요한 조건 |
| --- | --- | --- |
| 읽기 연결 실패 | 제한된 원본 우회 또는 실패 응답 | DB 처리 여력·동시성·deadline |
| 저장 실패 | 원본 결과 반환을 허용할지 결정 | 캐시 미등록 지표·다음 miss 증가 |
| 변경 뒤 삭제 실패 | 경고만으로 끝낼지 복구를 예약할지 결정 | 오래된 값의 허용 시간·복구 신뢰성 |
| 역직렬화 실패 | 잘못된 형식·배포 충돌 진단 | 특정 키·새 prefix·형식 호환성 |

GET·PUT·EVICT·CLEAR는 업무 영향이 다르므로 같은 “무시” 정책으로 처리하지 않는다. 입력 오류·권한 오류까지 장애 fallback으로 삼키지도 않는다. 특히 삭제 실패는 정상 조회 성능의 문제가 아니라 변경 후 최신성의 문제다.

예를 들어 1000 RPS 중 캐시 hit이 90%라면 정상 상태의 원본 진입은 대략 100 RPS다. 모든 요청을 원본으로 우회하면 최대 약 1000 RPS로 늘 수 있다. 이 계산은 작성한 단순 부하 예시이며 실제 비율·동시성·재시도는 측정해야 한다.

이 때문에 fail-open에는 앞선 Bulkhead·Rate Limiter·timeout 정책을 함께 검토한다. 로컬 제한은 서버 수만큼 합산된다는 점도 기억한다. Redis 재시작이나 새 prefix 배포로 캐시가 비는 **cold cache(비어 있는 캐시)** 상황도 같은 부하 점검 대상이다.

### 3.9 TTL·메모리 제한·전체 삭제를 별도로 운영한다

TTL은 최신성의 시간 정책이고 **eviction**은 용량 부족 등으로 항목을 제거하는 정책이다. Redis의 `maxmemory`와 `maxmemory-policy`는 공유 저장소 차원의 메모리 관리이며 Caffeine의 `maximumSize`와 같은 항목 개수 설정이 아니다. [Redis eviction 정책](https://redis.io/docs/latest/develop/reference/eviction/)

캐시 전용 저장소에서는 다시 생성할 수 있는 값을 제거하는 정책을 검토할 수 있다. 반면 `noeviction`은 용량 부족 때 새 데이터를 기록하는 명령에 오류를 낼 수 있다. 캐시와 세션·멱등성 기록처럼 유실 시 영향이 큰 키를 같은 eviction 범위에 무심코 섞지 않는다.

**SCAN**은 커서로 키 공간을 나누어 탐색하는 명령이다. 앞의 writer는 대량 키를 한 번에 찾는 기본 `KEYS` 방식 대신 SCAN 기반 삭제를 선택했다. `1000`은 학습용 탐색 배치 설정이며, SCAN의 `COUNT`는 항상 정확히 그 개수를 반환하라는 보장이 아니다. [Spring Redis 삭제 전략](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html), [SCAN 계약](https://redis.io/docs/latest/commands/scan/)

SCAN으로 바꿔도 전체 삭제가 순간적인 원자 작업이나 원본 DB 변경과 동시 확정이 되는 것은 아니다. 기본 non-locking writer의 여러 명령과 concurrent write를 함께 고려한다. 운영에서 전역 `FLUSHDB`·`FLUSHALL`을 학습용 캐시 정리 명령처럼 사용하지 않는다.

관리자에서 켠 통계는 해당 인스턴스의 로컬 hit·miss 집계다. Redis 전체 메모리·만료·eviction·오류와 앱별 캐시 지표·원본 부하를 함께 본다. 서버 하나의 높은 적중률만으로 전체 서비스의 최신성·가용성을 평가하지 않는다. [Spring Redis 통계 범위](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)

추가 로컬 캐시를 Redis 앞에 놓으면 네트워크 접근을 줄일 수 있지만, Redis 키를 삭제해도 그 로컬 복사본은 남을 수 있다. **Pub/Sub**는 발행 채널의 메시지를 구독자에게 전달하는 기능이며 Redis에서는 연결이 끊긴 구독자에게 놓친 메시지를 자동 재전달하지 않는 at-most-once 의미를 가진다. 로컬 무효화 통지를 붙이는 것만으로 복구가 완성되었다고 보지 않는다. [Redis Pub/Sub 전달 의미](https://redis.io/docs/latest/develop/pubsub/#delivery-semantics)

### 3.10 공유 저장소 테스트와 실제 서버 검증을 나눈다

먼저 두 관리자가 같은 키를 읽고 삭제하는지 검사할 수 있다. 아래는 **학습용 전용 Redis가 실행되어 있어야 하는 완전한 JUnit 테스트 클래스**다. Boot 자동 구성·Service 프록시·DB 트랜잭션을 거치지 않고, 위 설정을 사용한 두 CacheManager 객체의 공유 동작만 검사한다.

**추가 파일:** `src/test/java/com/example/rediscache/RedisSharedCacheTest.java`.

```java
package com.example.rediscache; // 위 설정 클래스를 사용할 수 있는 테스트 패키지다.

import java.util.Objects; // 등록되지 않은 캐시 이름을 즉시 감지한다.
import java.util.UUID; // 다른 테스트의 키와 충돌하지 않는 키를 만든다.
import org.junit.jupiter.api.Test; // JUnit 테스트 메서드를 표시한다.
import org.springframework.cache.Cache; // Redis를 감싼 Spring Cache 계약을 사용한다.
import org.springframework.data.redis.cache.RedisCacheManager; // 독립된 관리자 두 개를 만든다.
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory; // 테스트에서 직접 연결 수명을 관리한다.
import static org.junit.jupiter.api.Assertions.assertEquals; // 다른 관리자가 같은 값을 읽는지 확인한다.
import static org.junit.jupiter.api.Assertions.assertNull; // 삭제 뒤 값이 없는지 확인한다.

class RedisSharedCacheTest {
    @Test // 외부 Redis를 사용하는 통합 검사이며 순수 단위 테스트는 아니다.
    void twoManagersShareTheSameEntry() {
        var factory = new LettuceConnectionFactory("127.0.0.1", 6379); // 운영이 아닌 전용 실습 Redis다.
        try { // 초기화·검사 중 실패해도 연결 자원을 정리한다.
            factory.afterPropertiesSet(); // Spring 밖에서 만들었으므로 초기화를 직접 수행한다.
            factory.start(); // 연결 팩토리를 사용할 수 있는 상태로 시작한다.
            var settings = new RedisCacheSettings(); // 위의 문자열·TTL·prefix 정책을 사용한다.
            RedisCacheManager managerA = settings.cacheManager(factory); // A 역할의 관리자다.
            RedisCacheManager managerB = settings.cacheManager(factory); // B 역할의 독립된 관리자다.
            managerA.afterPropertiesSet(); // 선언된 캐시 이름을 초기화한다.
            managerB.afterPropertiesSet(); // B도 같은 이름·정책으로 초기화한다.
            Cache cacheA = Objects.requireNonNull(managerA.getCache("productNames")); // A에서 캐시를 찾는다.
            Cache cacheB = Objects.requireNonNull(managerB.getCache("productNames")); // B에서 같은 이름을 찾는다.
            String key = "test:" + UUID.randomUUID(); // 실제 상품 키를 덮어쓰지 않는 테스트 전용 키다.
            try { // 생성한 키는 assertion 실패 시에도 지운다.
                cacheA.put(key, "공유 이름"); // A가 Redis에 문자열을 기록한다.
                assertEquals("공유 이름", cacheB.get(key, String.class)); // B가 같은 저장 항목을 읽어야 한다.
                cacheA.evict(key); // A에서 해당 키만 삭제한다.
                assertNull(cacheB.get(key)); // B에서 다시 읽으면 값이 없어야 한다.
            } finally {
                cacheA.evict(key); // 이번 테스트의 키만 정리하며 전체 저장소는 비우지 않는다.
            }
        } finally {
            factory.destroy(); // 직접 만든 Redis 연결 자원을 반환한다.
        }
    }
}
```

연결 팩토리의 초기화·종료는 컨테이너 밖에서 객체를 생성한 이 검사에 필요하다. 운영 Bean을 매 요청 직접 만들고 종료하라는 뜻이 아니다. 테스트는 실행 동안 Redis를 사용할 수 있고 30초 만료 전에 조회한다는 조건을 가진다. [Lettuce 연결 수명 API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/connection/lettuce/LettuceConnectionFactory.html)

**실행 위치:** Java·Gradle Wrapper·전용 Redis를 준비한 실습 프로젝트 루트다. TIL 저장소 자체의 실행 명령이 아니며 이번 작성에서는 수행하지 않았다.

```powershell
.\gradlew.bat test --tests com.example.rediscache.RedisSharedCacheTest # 정상 조건에서 assertion 통과와 BUILD SUCCESSFUL을 확인한다.
```

이 테스트를 실제 두 서버 검사로 확대할 때는 공통 DB를 읽는 두 애플리케이션을 실행하고 다음을 확인한다. 아래는 검증 계획이지 실행 결과가 아니다.

| 시나리오 | 기대하거나 확인할 사항 |
| --- | --- |
| A의 최초 조회 → B의 조회 | 동일 prefix·키에서 원본 조회가 재사용되는지 |
| 쓰기 없이 만료 후 조회 | Redis TTL이 줄고 다시 원본을 읽는지 |
| DB 수정 commit → B 재조회 | 무효화 반영 후 새 이름을 읽는지 |
| 바깥 트랜잭션 rollback | DB·캐시가 실패 경로에서 어긋나지 않는지 |
| commit 성공 뒤 삭제 실패 | DB는 확정되고 삭제 복구·응답 정책이 관찰되는지 |
| 동시 miss·Redis 사용 불가 | 원본 호출량·대기·거절·오류 정책이 제한되는지 |
| 잘못된 값 형식·캐시 이름 | 문제를 감지하고 다른 업무 오류와 구분하는지 |

실제 키를 확인하려면 예제의 정확한 prefix를 사용한 `GET`·`TTL`로 살펴본다. 모든 운영 키를 출력하거나 민감한 값을 로그로 기록하지 않는다. 문서 링크·펜스·집계 검사는 이 런타임 검사를 대신하지 않는다.

## 4. 적용 관점에서 다시 보기

이미 배운 기준을 상품 이름 조회에 적용하면 다음 순서로 정리할 수 있다.

1. **공유 대상을 정한다.** 두 서버가 같은 DB·Redis·키 계약을 사용하며, 표시 정보와 정확한 업무 판단을 분리하는지 확인한다.
2. **형식을 고정한다.** 문자열 전용 캐시부터 시작하고 환경·캐시 이름·형식 버전·개인화 조건을 섞지 않는다.
3. **연결과 보관 정책을 연결한다.** 연결 timeout·TTL·serializer·관리자 등록 위치를 확인하고 중복 설정을 제거한다.
4. **변경의 실패 구간을 정의한다.** commit 이후 삭제·삭제 실패·동시 오래된 기록·영향받는 목록을 검토한다.
5. **장애 우회를 계산한다.** fail-open을 선택하면 증가한 원본 호출을 처리할 한도와 deadline을 함께 정한다.
6. **정확성과 비용을 따로 검증한다.** 공유 읽기·삭제·만료·rollback·장애를 검사하고 적중률·지연·메모리·원본 부하를 관찰한다.

서버마다 값이 다르면 먼저 Redis 주소·prefix·추가 로컬 캐시를 확인한다. 값은 공유되는데 오래되었다면 DB 변경과 무효화의 순서·실패·재삽입을 본다. Redis 오류 때 DB까지 과부하가 난다면 우회 정책의 호출량 제한부터 점검한다.

## 5. 배운 점 / 확장 포인트

### 5.1 이번 노트의 핵심 이해

Redis 공유 캐시는 보관 결과를 여러 서버가 재사용하게 하지만, 원본 DB와 캐시의 시간 차이를 없애지는 않는다. 네트워크·형식·commit 뒤 삭제·원본 보호를 하나의 조회 흐름 안에서 연결해야 한다.

### 5.2 이전·다음 학습과의 연결

[Caffeine 노트](../29_09_30_Spring_Cache_and_Caffeine/09_30_Spring_Cache_and_Caffeine.md)의 로컬 최신성 문제를 공유 저장소로 확장하고, Outbox·멱등성·resilience의 실패 판단을 다시 연결했다. 다음에는 **Spring Boot 비동기 처리와 `@Async`·스레드 풀**을 학습해 별도 실행 흐름의 대기·예외·트랜잭션 경계를 구분한다.

### 5.3 더 파볼 만한 주제

로컬·공유 캐시를 함께 둘 때 어떤 무효화·재연결 정책이 필요한지, 데이터 버전과 이벤트를 결합해 오래된 재삽입을 어떻게 차단할지 확장할 수 있다. Redis 복제 지연·장애 전환·Cluster 환경에서는 이 노트의 단일 저장소 가정이 어떻게 달라지는지도 후속 주제다.

### 5.4 참고 자료

- [Boot Redis 연결](https://docs.spring.io/spring-boot/reference/data/nosql.html): starter·Lettuce·자동 연결 구성
- [Boot 연결 속성](https://docs.spring.io/spring-boot/appendix/application-properties/index.html): 연결·읽기 timeout과 Redis 설정
- [Spring Data Redis Cache](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html): TTL·TTI·writer·삭제 전략·통계 범위
- [RedisCacheConfiguration API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheConfiguration.html): prefix·TTL·serializer·기본값
- [RedisCacheManager builder API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheManager.RedisCacheManagerBuilder.html): 사전 캐시 등록·동적 생성 제한·트랜잭션 연동
- [RedisCacheWriter API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/cache/RedisCacheWriter.html): 로딩 콜백과 잠금 구성의 계약
- [StringRedisSerializer API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/serializer/StringRedisSerializer.html): 문자열·UTF-8 바이트 변환
- [RedisTemplate 직렬화](https://docs.spring.io/spring-data/redis/reference/redis/template.html): 별도 데이터 접근 경로의 형식과 보안 고려
- [TransactionAwareCacheDecorator API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/transaction/TransactionAwareCacheDecorator.html): commit 후 작업과 즉시 연산 제약
- [SimpleCacheErrorHandler API](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/cache/interceptor/SimpleCacheErrorHandler.html): 캐시 오류의 기본 전파
- [LettuceConnectionFactory API](https://docs.spring.io/spring-data/redis/docs/current/api/org/springframework/data/redis/connection/lettuce/LettuceConnectionFactory.html): 직접 만든 연결 팩토리의 수명 관리
- [Redis SET](https://redis.io/docs/latest/commands/set/) · [TTL](https://redis.io/docs/latest/commands/ttl/) · [SCAN](https://redis.io/docs/latest/commands/scan/): 저장·만료 확인·커서 탐색
- [Redis eviction](https://redis.io/docs/latest/develop/reference/eviction/): 메모리 제한과 용량 부족 정책
- [Redis Docker 실행](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/) · [보안](https://redis.io/docs/latest/operate/oss_and_stack/management/security/): 로컬 준비와 운영 보호의 구분
- [Redis Pub/Sub](https://redis.io/docs/latest/develop/pubsub/): 무효화 통지의 전달 한계

## 6. 요약 정리

1. 같은 Redis·같은 키를 사용하는 서버는 저장 결과를 공유하지만, 원본 DB와의 원자적 변경까지 보장하지 않는다.
2. Prefix와 키는 환경·형식·조회 조건을 구분한다. 인증·인가나 자원 격리를 대신하지 않는다.
3. 네트워크 캐시는 직렬화 계약이 필요하다. 캐시 관리자와 RedisTemplate의 형식을 각각 확인한다.
4. 값과 TTL을 같이 기록하고 만료 없는 키·일반 읽기·TTI를 구분한다.
5. `transactionAware()`는 일반 캐시 작업을 commit 시점에 맞추는 장치이며, DB 확정 뒤 Redis 삭제 실패는 따로 복구해야 한다.
6. 공유 캐시와 분산 로딩 잠금은 다르다. 동시 miss·오래된 재삽입·cold cache의 원본 부하를 검증한다.
7. Redis 오류는 정상 miss가 아니다. 읽기 우회·저장·삭제 오류 정책을 나누고 원본 한도를 계산한다.
8. TTL·eviction·전체 삭제는 서로 다른 정책이다. 앱별 통계·Redis 상태·변경 후 최신성을 함께 관찰한다.

🧠 기억할 것: **공유 캐시는 저장된 값을 공유할 뿐이다. 원본 변경·키 형식·삭제 실패·장애 우회까지 같은 흐름에서 설계해야 여러 서버의 응답을 설명할 수 있다.**

## 7. 미니 퀴즈 또는 체크리스트

1. A와 B가 같은 Redis에 연결했지만 prefix가 다르다. A가 기록한 이름을 B가 hit할 수 있는가? 추가 로컬 캐시가 있으면 Redis 삭제만으로 충분한가?
2. 30초 TTL로 기록한 키에 만료 옵션 없이 `SET`을 다시 수행했다. TTL이 자동 유지되는가? TTL의 `-1`과 `-2`는 어떻게 다른가?
3. 문자열 serializer를 설정한 `productNames` 캐시에 ProductView DTO를 넣어도 되는가? RedisTemplate의 JSON 설정으로 해결되었다고 볼 수 있는가?
4. DB commit 성공 뒤 Redis 삭제가 실패하고 API가 예외를 반환했다. DB 변경이 없다고 판단할 수 있는가? `transactionAware()`가 두 저장소를 함께 rollback하는가?
5. 적중률 90%에서 모든 캐시 읽기를 원본으로 우회했다. 원본 호출량은 얼마나 늘 수 있으며, 두 서버의 동시 miss를 공유 Redis만으로 합칠 수 있는가?

<details>
<summary>정답과 해설</summary>

1. 다른 prefix는 다른 키이므로 동일 항목의 hit이 아니다. 로컬 복사본이 있다면 Redis 키 삭제가 그 복사본까지 지우지 않으므로 별도 최신성·무효화 정책이 필요하다.
2. 일반 SET은 이전 TTL을 제거할 수 있다. `-1`은 존재하지만 만료가 없는 키이고 `-2`는 키가 없는 상태다. 저장 시 만료 계약을 함께 전달해야 한다.
3. 이 캐시는 String 전용이므로 DTO 저장은 계약에 맞지 않는다. RedisTemplate과 RedisCacheManager는 별도 경로다. DTO를 보관하려면 관리자의 형식과 양쪽 앱의 배포 호환성을 설계한다.
4. DB는 이미 확정되었을 수 있다. transactionAware는 일반 캐시 작업의 실행 시점을 맞출 뿐이며, commit 후 Redis 오류가 확정된 DB를 자동으로 되돌리지는 않는다. 삭제 복구·허용 최신성·멱등 재요청을 함께 판단한다.
5. 단순 계산으로 원본 비율이 10%에서 100%가 되어 약 10배가 될 수 있다. 공유 저장소만으로 동시에 시작한 두 miss의 원본 실행이 합쳐지는 것은 아니다. writer·잠금·로딩 정책과 원본 호출 제한을 별도로 검증해야 한다.

</details>
