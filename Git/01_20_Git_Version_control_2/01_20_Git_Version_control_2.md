# Git Version Control 2: 원격 저장소와 변경 이력 되돌리기

- 🎯 글의 목표: Git의 로컬 저장소를 GitHub 원격 저장소와 연결하고, `push`·`pull`·`clone`으로 이력을 주고받으며, `revert`·`reset`·`amend`·`restore`로 상황에 맞게 변경 사항을 되돌리는 방법을 이해한다.
- 🧩 핵심 키워드: Remote Repository, GitHub, remote, origin, push, pull, clone, upstream, gitignore, revert, reset, amend, restore, unstage, reflog, README, TIL
- ⭐ 중요도: ★★★★★
- 📝 한눈에 보는 내용: 로컬에서 만든 commit을 원격 저장소에 올리고 다른 작업 환경으로 가져오는 협업의 기본 흐름부터 시작한다. 이어서 공개하면 안 되는 파일을 `.gitignore`로 제외하는 법, 공개 이력과 로컬 이력을 안전하게 되돌리는 기준, 직전 commit과 Working Directory·Staging Area를 수정하는 명령을 차례로 정리한다.
- 🔗 관련 문제 / 주제: GitHub 저장소 연결, 팀 프로젝트 동기화, TIL 저장소 운영, 잘못된 commit 복구, staging 취소, 삭제한 commit 복원

---

## 1. 들어가며

이전까지 Git으로 파일의 변경 사항을 commit했다면, 그 기록은 기본적으로 내 컴퓨터의 로컬 저장소 안에만 있다. 하지만 실제 개발에서는 한 사람이 한 컴퓨터에서만 코드를 관리하지 않는다. 여러 개발자가 같은 프로젝트를 받아 작업하고, 각자의 commit을 공유하며, 컴퓨터를 바꾸어도 기존 이력을 이어서 사용해야 한다.

Git이 **분산 버전 관리 시스템**이라는 말은 참여자마다 프로젝트의 파일과 commit 이력을 복제해 가질 수 있다는 뜻이다. 그렇다면 그 복제본을 처음 어디에서 받고, 새 commit은 어디에 모아야 할까? 이 역할을 하는 곳이 원격 저장소이다.

이번 강의의 전반부에서는 로컬 저장소와 GitHub 저장소를 연결한 뒤 다음 흐름을 만든다.

1. `git remote add`로 원격 저장소 주소를 등록한다.
2. `git push`로 로컬 commit을 원격 저장소에 올린다.
3. 다른 작업 환경에서는 `git clone`으로 저장소 전체를 처음 복제한다.
4. 이미 복제한 저장소에서는 `git pull`로 새 변경 이력을 받아온다.

후반부에서는 작업을 잘못했을 때 어느 지점을 되돌려야 하는지 구분한다. commit 하나를 취소할지, 과거 commit으로 이력 자체를 옮길지, 마지막 commit만 고칠지, 아직 commit하지 않은 파일 수정을 버릴지에 따라 명령이 달라진다. 명령 이름만 외우기보다 **어느 영역과 어느 이력을 바꾸는가**를 기준으로 이해하는 것이 중요하다.

---

## 2. 핵심 개념 정리

이번 강의가 해결하려는 질문은 크게 두 가지다.

> 내 컴퓨터의 Git 이력을 다른 개발자와 어떻게 공유하며, 잘못된 변경은 어느 단계에서 어떻게 되돌려야 할까?

첫 번째 질문은 로컬과 원격의 관계를 이해하면 풀린다. Git은 버전 관리 도구이고, GitHub는 Git 저장소를 온라인에서 보관하고 협업 기능을 제공하는 서비스이다. 로컬 저장소에 GitHub 저장소의 URL과 별칭을 등록한 뒤, commit 단위의 이력을 밀어 올리거나 가져온다.

두 번째 질문은 Git의 세 영역과 commit 이력을 함께 보면 풀린다.

| 위치 | 현재 담고 있는 것 | 대표 동작 |
|---|---|---|
| Working Directory | 실제로 편집 중인 파일 | 수정, `git restore` |
| Staging Area | 다음 commit에 포함할 변경 스냅샷 | `git add`, unstage |
| Local Repository | 이미 확정된 commit 이력 | `commit`, `revert`, `reset`, `amend` |
| Remote Repository | 온라인에 공유된 commit 이력 | `push`, `pull`, `clone` |

본문은 이 지도를 따라 진행한다. 먼저 원격 저장소를 등록하고 commit을 주고받는 흐름을 익힌다. 그다음 `.gitignore`와 GitHub 활용법을 살펴본다. 마지막으로 공개된 이력을 안전하게 취소하는 `revert`, 로컬 이력을 과거로 옮기는 `reset`, 직전 commit을 교체하는 `amend`, commit 전 변경을 다루는 `restore`와 unstage, 그리고 `reflog`를 이용한 복구까지 연결한다.

---

## 3. 본문 정리

이 섹션에서는 강의 순서대로 원격 저장소와 되돌리기 명령을 정리한다. 각 명령은 실행 문법만 보지 않고, 실행 전후에 어느 영역의 상태가 바뀌는지까지 함께 확인한다.

### 3.1 원격 저장소: 코드와 이력을 공유하는 온라인 저장 공간

원격 저장소(Remote Repository)는 **코드와 버전 관리 이력을 온라인의 특정 위치에 저장하여 여러 개발자가 협업하고 코드를 공유할 수 있게 하는 저장 공간**이다.

로컬 저장소만 있어도 Git의 commit 기능은 사용할 수 있다. 그러나 다른 사람이 내 컴퓨터의 `.git` 디렉터리에 직접 접근할 수는 없다. 팀이 함께 접근할 수 있는 원격 저장소를 두면 각 개발자는 그곳에서 저장소를 복제하고, 자신이 만든 commit을 올리고, 동료가 올린 commit을 받아올 수 있다.

대표적인 원격 저장소 서비스에는 다음이 있다.

| 서비스 | 설명 |
|---|---|
| GitHub | 공개·비공개 Git 저장소와 다양한 협업 기능을 제공한다. |
| GitLab | Git 저장소와 CI/CD 등 개발 수명 주기 기능을 함께 제공한다. |
| Bitbucket | Git 저장소 호스팅과 팀 협업 기능을 제공한다. |

여기서 Git과 GitHub를 같은 것으로 이해하면 안 된다.

| 구분 | Git | GitHub |
|---|---|---|
| 정체 | 분산 버전 관리 프로그램 | Git 원격 저장소 호스팅 서비스 |
| 실행 위치 | 로컬 컴퓨터에서도 독립적으로 사용 가능 | 네트워크를 통해 접속 |
| 핵심 역할 | 변경 이력 생성·조회·분기·병합 | 저장소 공유, 협업, 이슈·리뷰 등 제공 |

GitHub를 쓰지 않아도 Git으로 commit할 수 있고, GitHub 외의 서비스를 원격 저장소로 사용할 수도 있다. 이번 강의에서는 여러 서비스 중 GitHub를 사용한다.

📌 핵심: Git은 이력을 관리하는 도구이고, GitHub는 그 Git 이력을 온라인에서 공유할 장소와 협업 기능을 제공하는 서비스이다.

---

### 3.2 GitHub 저장소를 만들고 로컬 저장소와 연결하기

GitHub에서 repository를 만들었다고 해서 기존 로컬 저장소와 자동으로 연결되지는 않는다. 로컬 Git 저장소에 원격 저장소의 URL을 등록해야 한다.

연결 전 준비 흐름은 다음과 같다.

1. GitHub 계정을 준비하고 로그인한다.
2. GitHub에서 새 repository를 생성한다.
3. repository가 제공하는 URL을 복사한다.
4. 로컬 저장소의 터미널에서 원격 저장소를 등록한다.

등록 명령의 기본 구조는 다음과 같다.

```bash
# 현재 로컬 저장소에 원격 저장소 하나를 등록한다.
# origin은 URL을 대신해 사용할 별칭이다.
git remote add origin <remote_repo_url>
```

예를 들어 원격 URL이 `https://github.com/username/git-practice.git`이라면 다음처럼 실행한다.

```bash
# 긴 GitHub URL을 origin이라는 짧은 이름으로 등록한다.
git remote add origin https://github.com/username/git-practice.git

# 등록된 원격 저장소의 별칭만 확인한다.
git remote

# fetch용 URL과 push용 URL까지 함께 확인한다.
git remote -v
```

예상 결과는 다음과 비슷하다.

```text
origin  https://github.com/username/git-practice.git (fetch)
origin  https://github.com/username/git-practice.git (push)
```

`origin`은 특별한 예약어가 아니라 관례적으로 첫 원격 저장소에 붙이는 이름이다. 하나의 로컬 저장소에 여러 원격 저장소를 등록할 수도 있으므로, 별칭이 URL을 구분하는 역할을 한다.

```bash
# 두 번째 원격 저장소는 origin과 다른 별칭으로 등록한다.
git remote add backup https://github.com/username/git-practice-backup.git

# 이제 origin과 backup이 모두 출력된다.
git remote -v
```

⚠️ 주의: `git remote add origin ...`을 두 번 실행하면 `remote origin already exists` 오류가 발생한다. 이미 등록된 URL이 맞는지 `git remote -v`로 먼저 확인해야 한다.

---

### 3.3 remote 관리 명령과 upstream 설정

원격 저장소는 등록 후에도 조회하거나 삭제할 수 있다. 원격 저장소를 삭제한다는 말은 GitHub의 repository 자체를 삭제한다는 뜻이 아니라, **현재 로컬 저장소에 저장된 연결 정보**를 없앤다는 뜻이다.

```bash
# 등록된 원격 저장소 이름과 URL을 확인한다.
git remote -v

# 현재 로컬 저장소에서 backup이라는 원격 연결 정보만 삭제한다.
git remote rm backup
```

원격 브랜치와 로컬 브랜치의 기본 연결 관계를 기록할 수도 있다.

```bash
# 로컬 master 브랜치를 origin의 master로 push하면서
# 이후 사용할 upstream 관계를 함께 기록한다.
git push --set-upstream origin master

# 같은 명령의 짧은 형태이다.
git push -u origin master
```

upstream이 설정되면 이후에는 현재 브랜치에서 원격 이름과 브랜치 이름을 생략한 `git push`, `git pull`을 사용할 수 있다. Git은 기록된 추적 관계를 기준으로 대상 브랜치를 판단한다.

강의 자료는 기본 브랜치 이름으로 `master`를 사용한다. 저장소에 따라 기본 브랜치가 `main`일 수 있으므로 실제 명령에서는 다음으로 현재 브랜치 이름을 먼저 확인한다.

```bash
# 별표가 붙은 항목이 현재 브랜치이다.
git branch

# 현재 브랜치가 main이라면 main을 사용한다.
git push -u origin main
```

⚠️ 주의: `master`와 `main`은 서로 다른 브랜치 이름이다. 강의 명령을 그대로 복사하기 전에 현재 저장소가 사용하는 이름을 확인해야 한다.

---

### 3.4 push: 로컬 commit 이력을 원격 저장소에 올리기

`push`는 로컬 저장소의 commit 이력을 원격 저장소에 업로드하는 작업이다. 단순히 현재 파일을 복사하는 것이 아니라, 로컬 브랜치에 쌓인 commit을 원격 브랜치에 전달한다.

```bash
# origin 원격 저장소의 master 브랜치로
# 현재 로컬 master 브랜치의 commit 이력을 올린다.
git push origin master
```

이 명령은 “Git아, `origin`이라는 원격 저장소의 `master` 브랜치에 현재 commit 이력을 올려 줘”라고 읽을 수 있다.

처음 원격 저장소를 연결한 뒤의 전체 흐름은 다음과 같다.

```bash
# 1. 현재 폴더를 Git 저장소로 만든다.
git init

# 2. 작업 파일의 변경 사항을 Staging Area에 올린다.
git add .

# 3. staged 변경을 하나의 로컬 commit으로 확정한다.
git commit -m "프로젝트 시작"

# 4. GitHub 저장소를 origin으로 등록한다.
git remote add origin <remote_repo_url>

# 5. 첫 push와 동시에 추적 관계를 설정한다.
git push -u origin master
```

최초 push 과정에서는 GitHub 로그인을 요청하거나 Git Credential Manager를 통한 인증 창이 나타날 수 있다. 이는 현재 사용자가 해당 원격 저장소에 push할 권한이 있는지 확인하기 위한 과정이다.

push가 성공하면 터미널에 객체를 세고 압축하여 전송했다는 메시지와 함께 로컬 브랜치가 원격 브랜치로 갱신되었다는 결과가 나타난다. 이어서 GitHub repository의 commit 목록을 열어 로컬에서 만든 commit이 보이는지 확인한다.

```text
To https://github.com/username/git-practice.git
 * [new branch]      master -> master
branch 'master' set up to track 'origin/master'.
```

그 뒤 로컬에서 세 번째 commit을 만들고 다시 push하면, 이미 올라간 첫 번째·두 번째 commit 전체를 새로 만드는 것이 아니라 원격에 없는 새 commit과 관련 객체가 전달된다. 최종적으로 두 저장소의 브랜치 이력이 같은 위치를 가리키게 된다.

⚠️ 주의: Working Directory에서 파일만 수정하고 commit하지 않았다면 push할 새 이력이 없다. `git push`는 저장하지 않은 파일 변경을 올리는 명령이 아니므로, 먼저 `git status`와 `git log --oneline`으로 상태를 확인해야 한다.

📌 핵심: 원격 저장소에 올라가는 기본 단위는 파일 한 장이 아니라 commit 이력이다.

---

### 3.5 GitHub에서 commit 확인하기

push 이후에는 GitHub의 파일 목록만 보지 말고 commit 목록과 상세 내역도 확인해야 한다. 로컬에서 만든 commit 제목, 작성 시점, hash, 변경 파일을 웹 화면에서도 확인할 수 있다.

로컬에서는 다음 명령으로 같은 흐름을 빠르게 확인한다.

```bash
# 한 줄에 commit 하나씩 간결하게 표시한다.
git log --oneline

# 특정 commit의 작성 정보와 변경 내용을 자세히 본다.
git show <commit_id>
```

예상 로그는 다음처럼 보일 수 있다.

```text
3e82a71 (HEAD -> master, origin/master) third
91cbd74 second
f7b3a3d first
```

`HEAD -> master`는 현재 로컬에서 `master`가 가리키는 위치이고, `origin/master`는 마지막으로 확인된 원격 추적 브랜치의 위치이다. push 직후 두 표시가 같은 commit에 있다면 해당 시점까지의 이력이 맞춰진 것이다.

---

### 3.6 clone과 pull: 원격 저장소의 코드를 가져오는 두 방법

원격 저장소의 코드를 내 컴퓨터로 가져오는 명령에는 `clone`과 `pull`이 있다. 두 명령은 사용하는 시점이 다르다.

| 명령 | 사용하는 시점 | 가져오는 범위 |
|---|---|---|
| `git clone` | 프로젝트를 처음 받을 때 | 저장소의 파일과 commit 이력 전체 |
| `git pull` | 이미 가진 저장소를 최신 상태로 갱신할 때 | 원격에 새로 생긴 변경 이력 |

처음 프로젝트를 받는다면 `clone`을 사용한다.

```bash
# 원격 저장소 전체를 현재 위치 아래 새 폴더로 복제한다.
git clone <remote_repo_url>

# 복제될 로컬 폴더 이름을 직접 지정할 수도 있다.
git clone <remote_repo_url> git-advanced
```

clone으로 받은 폴더에는 이미 `.git` 디렉터리와 원격 연결 정보가 들어 있다. 따라서 그 안에서 다시 `git init`하거나 같은 `origin`을 또 등록할 필요가 없다.

```bash
# clone한 폴더로 이동한다.
cd git-advanced

# origin이 자동 등록되었는지 확인한다.
git remote -v

# 기존 commit 이력이 함께 복제되었는지 확인한다.
git log --oneline
```

이미 clone한 저장소에서 다른 사람이 push한 새 commit을 받으려면 `pull`을 사용한다.

```bash
# origin의 master 브랜치에서 새 이력을 가져와
# 현재 브랜치에 반영한다.
git pull origin master
```

쉽게 구분하면 `clone`은 **처음 이사할 때 집 전체를 복제하는 작업**이고, `pull`은 **이미 사는 집에 새로 배달된 변경분을 받아 반영하는 작업**이다.

⚠️ 주의: 원격 저장소를 처음 받으면서 빈 폴더에서 `git init`과 `pull`을 조합하려 하지 않아도 된다. 처음에는 `clone`, 이미 로컬 저장소가 있으면 `pull`이라는 기준이 가장 명확하다.

---

### 3.7 두 작업 환경으로 보는 push·clone·pull 흐름

강의에서는 두 개의 폴더를 두 명의 사용자라고 가정해 원격 협업 흐름을 확인한다.

처음 상태에서 사용자 1의 로컬 저장소와 GitHub에는 `commit 1`, `commit 2`가 있다고 하자. 사용자 2는 이 프로젝트를 처음 받으므로 전체 저장소를 clone한다.

```text
사용자 1 로컬: commit 1 → commit 2
GitHub 원격:   commit 1 → commit 2
사용자 2 로컬: clone 후 commit 1 → commit 2
```

이후 사용자 1이 새 작업을 commit하고 push한다.

```bash
# 사용자 1의 폴더에서 실행한다.
git add .
git commit -m "third"
git push origin master
```

이 시점에는 사용자 2의 로컬 저장소에 `third` commit이 없다.

```text
사용자 1 로컬: commit 1 → commit 2 → commit 3
GitHub 원격:   commit 1 → commit 2 → commit 3
사용자 2 로컬: commit 1 → commit 2
```

사용자 2가 pull하면 자신의 저장소에 없던 새 이력을 받아온다.

```bash
# 사용자 2의 clone 폴더에서 실행한다.
git pull origin master
```

pull이 정상적으로 끝나면 두 폴더의 파일과 commit 이력이 같은 최신 상태가 된다.

```text
사용자 1 로컬: commit 1 → commit 2 → commit 3
GitHub 원격:   commit 1 → commit 2 → commit 3
사용자 2 로컬: commit 1 → commit 2 → commit 3
```

이 실습에서 중요한 것은 파일 모양만 같아지는 것이 아니다. 사용자 2도 `git log --oneline`으로 `commit 3`을 확인할 수 있어야 저장소 이력이 동기화된 것이다.

---

### 3.8 원격 저장소 기본 실습 두 가지

첫 번째 실습은 새 로컬 저장소의 commit을 새 GitHub repository에 올리는 것이다.

```bash
# 새 작업 폴더를 만들고 이동한다.
mkdir remote-practice
cd remote-practice

# 로컬 저장소와 첫 commit을 준비한다.
git init
touch README.md
git add README.md
git commit -m "README 작성"

# 새 GitHub repository를 연결하고 push한다.
git remote add origin <first_remote_url>
git push -u origin master
```

두 번째 실습은 같은 로컬 저장소에 원격 저장소를 하나 더 등록하는 것이다. 이미 `origin`이 있으므로 다른 별칭을 사용한다.

```bash
# 두 번째 GitHub repository를 second라는 별칭으로 등록한다.
git remote add second <second_remote_url>

# 두 원격 연결을 모두 확인한다.
git remote -v

# 같은 master 이력을 두 번째 원격 저장소에도 올린다.
git push -u second master
```

⚠️ 주의: 마지막 명령에서 `-u`를 사용하면 현재 로컬 브랜치의 upstream 대상이 `second/master`로 바뀔 수 있다. 여러 원격 저장소를 함께 쓰는 동안에는 생략형 `git push`보다 `git push origin master`처럼 대상을 명시하는 편이 혼동을 줄인다.

---

### 3.9 `.gitignore`: 추적하지 않을 파일과 디렉터리 지정하기

`.gitignore`는 Git이 특정 파일이나 디렉터리를 추적 대상으로 보지 않도록 패턴을 적는 텍스트 파일이다. 프로젝트에는 소스 코드처럼 공유해야 할 파일도 있지만, 공개하면 안 되거나 각 컴퓨터에서 다시 만들 수 있어 공유할 필요가 없는 파일도 있다.

대표적인 제외 대상은 다음과 같다.

- 비밀번호와 API key가 들어 있는 환경 설정 파일
- 운영체제가 자동 생성하는 임시 파일
- 에디터의 개인 설정 파일
- 빌드 결과물과 캐시
- 패키지 관리 도구가 다시 설치할 수 있는 의존성 디렉터리

`.gitignore`는 이름 맨 앞에 점이 있고 확장자가 없다.

```gitignore
# a.txt 파일 하나를 무시한다.
a.txt

# logs 디렉터리 아래 내용을 무시한다.
logs/

# 확장자가 .log인 모든 파일을 무시한다.
*.log

# 환경 변수 파일을 무시한다.
.env
```

강의 실습은 다음 순서로 진행한다.

```bash
# 실습 파일 두 개를 만든다.
touch a.txt b.txt

# .gitignore에는 a.txt를 기록한다.
# 편집기로 파일을 만들고 a.txt 한 줄을 작성해도 된다.

# 저장소를 초기화하고 상태를 확인한다.
git init
git status
```

`git status`에는 추적되지 않은 `b.txt`와 `.gitignore`가 보이지만, 무시 대상으로 지정한 `a.txt`는 보이지 않는다.

이미 Git이 추적한 이력이 있는 파일은 나중에 `.gitignore`에 추가해도 즉시 무시되지 않는다. `.gitignore`는 아직 추적하지 않는 파일에 적용되는 규칙이기 때문이다.

```bash
# 파일은 Working Directory에 남겨두고
# Git의 index에서만 제거한다.
git rm --cached .env

# 이후 .gitignore에 .env를 기록하고 그 변경을 commit한다.
git add .gitignore
git commit -m "환경 설정 파일 추적 제외"
```

운영체제, 프레임워크, 언어별 기본 패턴은 `https://www.toptal.com/developers/gitignore/` 같은 생성 서비스를 참고할 수 있다. 다만 생성된 목록을 그대로 믿기보다 프로젝트에서 공유해야 하는 파일까지 제외되지 않았는지 확인해야 한다.

⚠️ 주의: `.gitignore`는 이미 commit에 포함된 비밀 정보를 과거 이력에서 지워 주지 않는다. 비밀 값이 한 번이라도 push되었다면 해당 키를 폐기·재발급하고, 필요하면 별도의 이력 정리 절차를 검토해야 한다.

---

### 3.10 `revert`: 기존 이력을 보존하며 특정 commit 취소하기

`git revert`는 특정 commit의 변경을 반대로 적용한 **새 commit**을 만드는 명령이다. 대상 commit을 이력에서 삭제하지 않으므로 공유된 기록을 안전하게 취소할 때 적합하다.

```bash
# 지정한 commit의 변경을 반대로 적용한다.
# 그 결과는 새로운 revert commit으로 기록된다.
git revert <commit_id>
```

예를 들어 다음과 같은 이력이 있다고 하자.

```text
d7c8501 (HEAD -> master) third   # 3.txt 생성
91cbd74 second                  # 2.txt 생성
f7b3a3d first                   # 1.txt 생성
```

`second` commit을 취소하려면 그 commit의 hash를 지정한다.

```bash
# 91cbd74를 식별할 수 있는 앞부분을 사용한다.
git revert 91cb
```

기본 설정에서는 새 revert commit 메시지를 확인하는 편집기가 열린다. 저장하고 종료하면 `second`가 만든 `2.txt`는 현재 파일 상태에서 사라지지만, `second` commit 자체는 로그에 남는다. 그 위에 취소 결과를 기록한 새 commit이 추가된다.

```text
a1b2c3d (HEAD -> master) Revert "second"
d7c8501 third
91cbd74 second
f7b3a3d first
```

이 구조를 순서로 읽으면 다음과 같다.

1. `second`는 2.txt를 추가했다.
2. `third`는 3.txt를 추가했다.
3. 새 revert commit은 `second`의 변경만 반대로 적용해 2.txt를 제거했다.
4. 과거의 `second` commit은 감사 가능한 이력으로 남아 있다.

commit id는 40자리 16진수 hash이지만, Git이 다른 commit과 구분할 수 있다면 앞부분만 사용할 수 있다. 강의 예시는 최소 네 글자를 사용한다. 실제 저장소에서는 충돌 없이 식별되는 길이가 더 길 수 있다.

⚠️ 주의: `git revert HEAD`는 HEAD commit 자체를 지우는 명령이 아니다. HEAD가 만든 변경을 취소하는 새 commit을 하나 더 만드는 명령이다.

📌 핵심: 공유된 이력에서는 과거를 삭제하기보다, 취소 사실까지 새 이력으로 남기는 `revert`가 안전하다.

---

### 3.11 revert의 추가 활용법

여러 commit을 각각 취소하거나, 편집기와 자동 commit 동작을 제어할 수 있다.

```bash
# 공백으로 여러 commit을 지정한다.
# 각 대상의 변경을 차례로 취소한다.
git revert 7f6c24c 006dc87 3551584

# 범위로 여러 commit을 지정한다.
# A..B는 A를 제외하고 B까지 도달 가능한 commit을 뜻한다.
git revert 3551584..7f6c24c

# 기본 revert 메시지를 사용하고 편집기를 열지 않는다.
git revert --no-edit 7f6c24c

# 취소 결과를 자동 commit하지 않고 Staging Area에 모은다.
# 여러 취소를 하나의 commit으로 묶고 싶을 때 사용할 수 있다.
git revert --no-commit 7f6c24c

# --no-commit으로 모은 결과를 검토한 뒤 직접 commit한다.
git status
git commit -m "여러 변경 사항 되돌리기"
```

범위나 여러 commit을 한꺼번에 되돌리면 같은 파일의 같은 부분을 여러 commit이 수정했을 때 충돌할 수 있다. 그 경우 충돌을 해결하고 staged 상태로 만든 뒤 revert를 계속 진행해야 한다.

⚠️ 주의: `--no-commit`은 취소하지 않는 옵션이 아니다. 변경을 Working Directory와 Staging Area에 적용하되, 마지막 commit 생성만 미루는 옵션이다.

---

### 3.12 `reset`: 로컬 이력을 특정 과거 commit으로 옮기기

`git reset`은 현재 브랜치가 가리키는 위치를 특정 과거 commit으로 되돌리는 명령이다. 되돌아간 commit 이후의 commit은 현재 브랜치 이력에서 보이지 않게 된다.

```bash
# 옵션에 따라 변경 내용을 남길 위치를 정하면서
# 현재 브랜치를 지정한 commit으로 옮긴다.
git reset [옵션] <commit_id>
```

시계를 과거로 돌린다고 비유할 수 있지만, 중요한 질문이 하나 더 있다. 과거 commit 이후에 만들었던 파일 변경을 어디에 남길 것인가? 이 선택이 `--soft`, `--mixed`, `--hard`의 차이다.

| 옵션 | commit 이력 | Staging Area | Working Directory |
|---|---|---|---|
| `--soft` | 대상 commit으로 이동 | 이후 변경을 staged 상태로 남김 | 변경 파일을 남김 |
| `--mixed` | 대상 commit으로 이동 | stage를 해제함 | 변경 파일을 남김 |
| `--hard` | 대상 commit으로 이동 | 대상 commit 상태로 덮어씀 | 대상 commit 상태로 덮어씀 |

`--mixed`는 옵션을 생략했을 때의 기본값이다.

```bash
# 다음 두 명령은 같은 의미이다.
git reset --mixed <commit_id>
git reset <commit_id>
```

`revert`와 `reset`의 차이는 이력 모양에서 분명해진다.

| 기준 | `revert` | `reset` |
|---|---|---|
| 취소 방식 | 반대 변경을 새 commit으로 기록 | 브랜치 포인터를 과거로 이동 |
| 기존 commit | 로그에 유지 | 현재 브랜치 로그에서 사라질 수 있음 |
| 공유 이력 | 사용하기 적합 | 일반적으로 사용하면 안 됨 |
| 대표 목적 | 공개된 잘못된 변경 취소 | 아직 공유하지 않은 로컬 이력 정리 |

---

### 3.13 reset `--soft`: commit만 풀고 변경은 staged로 남기기

다음 세 commit이 있는 저장소에서 `first`로 돌아간다고 하자.

```text
d7c8501 (HEAD -> master) third
91cbd74 second
f7b3a3d first
```

`--soft`를 사용하면 브랜치 이력은 `first`로 이동하지만, `second`와 `third`가 만든 변경은 Staging Area에 남는다.

```bash
# first commit으로 이동하되 이후 변경은 staged로 보존한다.
git reset --soft f7b3

# 로그에는 first까지만 보인다.
git log --oneline

# second와 third의 변경은 Changes to be committed에 보인다.
git status
```

예상 상태는 다음과 같다.

```text
Commit History:    first
Staging Area:      2.txt와 3.txt의 추가 변경
Working Directory: 1.txt, 2.txt, 3.txt가 존재
```

이 상태에서는 기존 두 commit을 다른 메시지의 하나의 commit으로 다시 묶을 수 있다.

```bash
# staged 상태가 이미 준비되어 있으므로 바로 새 commit을 만든다.
git commit -m "두 기능을 하나의 commit으로 정리"
```

`--soft`는 commit 경계만 다시 만들고 싶을 때 유용하다. 파일 변경을 잃지 않고, `git add`도 다시 하지 않아도 된다.

---

### 3.14 reset `--mixed`: commit과 stage를 풀고 변경은 파일로 남기기

`--mixed`도 commit 이력을 `first`로 옮기지만, 이후 변경을 Staging Area가 아니라 Working Directory의 수정으로 남긴다.

```bash
# --mixed는 기본 옵션이다.
git reset --mixed f7b3

# 같은 동작이다.
# git reset f7b3

# 로그와 파일 상태를 차례로 확인한다.
git log --oneline
git status
```

예상 상태는 다음과 같다.

```text
Commit History:    first
Staging Area:      비어 있음
Working Directory: 2.txt와 3.txt에 해당하는 변경이 남음
```

변경 내용을 다시 살펴보고 일부만 골라 stage하거나, commit을 더 잘게 나누고 싶을 때 사용할 수 있다.

```bash
# 남은 변경 중 2.txt만 먼저 stage하고 commit한다.
git add 2.txt
git commit -m "second 변경 다시 정리"

# 이어서 3.txt를 별도 commit으로 만든다.
git add 3.txt
git commit -m "third 변경 다시 정리"
```

---

### 3.15 reset `--hard`: 이력과 파일을 모두 대상 commit 상태로 맞추기

`--hard`는 가장 강한 reset 옵션이다. 브랜치 이력을 과거로 옮기는 것뿐 아니라 Staging Area와 Working Directory도 대상 commit의 상태로 맞춘다.

```bash
# first 이후의 commit과 추적 파일 변경을 버리고
# 저장소를 first commit 상태로 맞춘다.
git reset --hard f7b3
```

실행 후에는 `second`, `third`가 현재 브랜치 로그에서 사라지고, 그 commit들이 만들었던 추적 파일 변경도 Working Directory에서 사라진다.

```text
Commit History:    first
Staging Area:      first 상태
Working Directory: first 상태
```

강의 예제의 `untracked.txt`처럼 한 번도 commit되지 않은 일반 untracked 파일은 reset의 대상 이력에 포함되지 않는다. 다만 실제 작업에서는 덮어쓰기 충돌이나 별도 정리 명령과의 조합으로 파일을 잃을 수 있으므로, `--hard` 전에 `git status`를 확인하고 필요한 내용을 백업해야 한다.

⚠️ 주의: `git reset --hard`는 저장하지 않은 추적 파일 변경을 즉시 버릴 수 있다. commit도 stash도 하지 않은 변경은 Git으로 복원할 수 없을 수 있으므로 의미를 모른 채 실행하면 안 된다.

---

### 3.16 공유된 commit에는 reset을 사용하지 않는 이유

reset은 로컬 브랜치의 과거를 다시 쓰는 명령이다. 아직 혼자만 가진 commit을 정리할 때는 유용하지만, 이미 원격에 push한 commit을 reset하면 로컬과 원격의 이력이 갈라진다.

더 큰 문제는 동료가 그 원격 commit을 이미 pull하거나 clone했을 때 발생한다. 동료의 저장소에는 기존 이력이 남아 있는데 내 저장소는 다른 과거를 기반으로 새 이력을 만들기 때문에, 이후 push·pull·merge 과정에서 충돌과 중복 이력이 생길 수 있다.

따라서 강의의 기본 판단 기준은 다음과 같다.

```text
아직 원격에 올리지 않은 내 로컬 commit인가?
├─ 예: 목적에 따라 reset을 검토한다.
└─ 아니요: 공유 이력을 보존하는 revert를 사용한다.
```

⚠️ 주의: 이미 원격에 올라간 commit을 reset한 뒤 강제 push로 덮는 행위는 협업자 전체의 이력을 바꾸는 작업이다. 이번 강의 범위에서는 사용하지 않고, 공개 이력은 `revert`로 취소한다.

---

### 3.17 GitHub 활용: 협업, 포트폴리오, 오픈 소스

GitHub는 commit을 보관하는 공간을 넘어 여러 방식으로 활용할 수 있다.

1. 개인·팀 프로젝트의 코드를 공유하고 협업한다.
2. 어떤 프로젝트와 코드를 작성했는지 보여 주는 포트폴리오로 활용한다.
3. TIL을 통해 매일 학습한 내용을 기록한다.
4. 공개 저장소의 문제를 고치거나 문서를 개선하여 오픈 소스에 기여한다.

면접이나 협업에서 GitHub 주소를 공유할 때는 repository 수만 중요한 것이 아니다. commit 메시지가 작업 내용을 설명하는지, README가 프로젝트를 이해할 수 있게 돕는지, 폴더 구조와 문서가 관리되고 있는지가 함께 드러난다.

이 때문에 문서화는 별도의 부가 작업이 아니다. 스스로 학습한 내용을 구조화하고, 다른 사람이 같은 정보를 다시 사용할 수 있게 전달하는 개발 역량이다.

강의에서는 개발 도구 활용 수준을 다음 흐름으로 소개한다.

| 수준 | 할 수 있는 일 |
|---|---|
| 레벨 0 | 안내나 가이드가 있어도 도구를 제대로 사용하기 어렵다. |
| 레벨 1 | 팀에서 만든 가이드 범위 안에서 도구를 사용할 수 있다. |
| 레벨 2 | 공식 레퍼런스를 읽어 사용법을 익히고, 경험을 문서화해 팀에 전파할 수 있다. |
| 레벨 3 | 여러 도구를 비교해 상황에 맞는 도구를 선택하고, 문서의 부족한 부분을 보완해 기여할 수 있다. |
| 레벨 4 | 도구의 소스 코드를 수정하거나 fork·patch하여 문제를 해결할 수 있다. |

신입 개발자에게도 공식 문서를 읽고 자신의 경험을 문서화하는 레벨 2 정도의 역량이 기대될 수 있다는 것이 강의의 메시지다.

---

### 3.18 TIL과 README.md 작성하기

TIL은 **Today I Learned**의 약자로, 그날 배운 것을 Markdown 문서로 정리하는 학습 기록이다. 수업 내용을 그대로 받아 적는 데서 끝나는 것이 아니라, 무엇을 이해했고 어떤 실습을 했는지 자신의 언어로 남기는 습관에 가깝다.

TIL 저장소의 폴더 구조에는 하나의 정답이 없다. 언어별, 날짜별, 주제별로 나눌 수 있다. 중요한 것은 다른 개발자의 TIL 저장소를 참고하되, 자신이 계속 찾고 갱신할 수 있는 규칙을 일관되게 유지하는 것이다.

TIL 저장소를 만드는 기본 흐름은 다음과 같다.

```bash
# 로컬에서 TIL 폴더를 저장소로 만든다.
mkdir TIL
cd TIL
git init

# 저장소 첫 화면에서 안내할 README를 만든다.
touch README.md

# 지금까지 정리한 내용을 첫 commit으로 남긴다.
git add README.md
git commit -m "TIL 저장소 시작"

# GitHub에 만든 TIL repository를 연결해 push한다.
git remote add origin <til_remote_url>
git push -u origin master
```

README.md는 프로젝트의 설명과 사용 방법 등 문서화된 정보를 제공하는 파일이다. Markdown으로 작성하며 일반적으로 다음 정보를 담을 수 있다.

- 프로젝트 소개와 목적
- 설치와 설정 방법
- 사용 예시
- 라이선스 정보
- 기여 방법

repository의 대표 문서로 보이게 하려면 README.md를 저장소 최상단에 둔다.

GitHub 프로필도 README로 꾸밀 수 있다. 자신의 GitHub username과 **정확히 같은 이름**의 공개 repository를 만들고, 그 저장소의 README.md를 작성하면 프로필 화면에 내용이 나타난다.

```text
GitHub username: octocat
프로필 repository 이름: octocat
프로필 주소: https://github.com/octocat
```

⚠️ 주의: README는 코드를 대신하는 장식이 아니다. 처음 방문한 사람이 저장소의 목적과 실행 방법을 찾을 수 있도록 정확하고 갱신 가능한 내용을 우선해야 한다.

---

### 3.19 `git commit --amend`: 바로 직전 commit 메시지 수정하기

`git commit --amend`는 가장 최근 commit을 새 내용으로 교체하는 명령이다. “오타 수정”이나 “빠진 파일 추가”만을 위한 의미 없는 commit을 하나 더 만들지 않고, 직전 commit 자체를 완성된 버전으로 고칠 때 사용한다.

먼저 메시지만 수정하는 흐름을 살펴보자.

```bash
# 실습 폴더와 저장소를 준비한다.
mkdir git-amend-practice
cd git-amend-practice
git init

# README.md를 포함한 첫 commit을 만든다.
touch README.md
git add .
git commit -m "A 기능 구현 완료"

# 현재 commit hash와 메시지를 확인한다.
git log --oneline
```

메시지에 잘못된 기능 이름을 적었다면 amend를 실행한다.

```bash
# 편집기에서 직전 commit 메시지를 수정한다.
git commit --amend
```

편집기가 열리면 첫 줄의 commit 메시지를 고치고 저장 후 종료한다. `git log --oneline`을 다시 실행하면 메시지뿐 아니라 commit hash도 달라진 것을 확인할 수 있다.

```text
변경 전: 7bcb03b A 기능 구현 완료
변경 후: 82779fb B 기능 구현 완료
```

hash가 바뀌는 이유는 commit 객체에 메시지와 파일 스냅샷 등의 정보가 포함되기 때문이다. 내용을 수정한 commit은 기존 객체 위에 글자만 덮어쓰는 것이 아니라 새로운 commit 객체로 교체된다.

⚠️ 주의: amend도 이력을 다시 쓰는 작업이다. 이미 push하여 다른 사람과 공유한 commit에는 함부로 사용하지 않는다.

---

### 3.20 amend로 직전 commit에 빠진 파일 포함하기

직전 commit에서 파일 하나를 빠뜨렸다면, 그 파일을 stage한 뒤 amend할 수 있다. 강의에서는 `b-function.txt`를 누락한 상황을 가정한다.

```bash
# 직전 commit에 빠진 파일을 만든다.
touch b-function.txt

# amend가 가져갈 수 있도록 Staging Area에 올린다.
git add .

# staged 변경을 직전 commit에 포함해 새 commit으로 교체한다.
git commit --amend
```

편집기에는 기존 메시지가 표시되고, commit될 파일 목록에는 README.md와 `b-function.txt`가 함께 나타난다. 메시지를 유지하거나 더 정확하게 수정한 뒤 저장한다.

```bash
# 바뀐 commit hash와 메시지를 확인한다.
git log --oneline

# 새 commit이 포함한 파일과 변경도 확인한다.
git show --stat HEAD
```

결과적으로 “파일을 빼먹어서 추가함”이라는 별도 commit을 남기지 않고, 직전 commit을 처음부터 두 파일을 포함한 완전한 버전처럼 정리할 수 있다.

```text
변경 전 commit: README.md만 포함
변경 후 commit: README.md + b-function.txt 포함
```

📌 핵심: amend는 직전 commit에 덧붙이는 것이 아니라, staged 내용과 메시지를 기준으로 직전 commit을 새 commit으로 교체한다.

---

### 3.21 `git restore`: Working Directory의 수정 취소하기

`git restore <file>`은 Working Directory에서 수정한 추적 파일을 기준 상태로 되돌린다. 아직 stage하지 않은 파일 수정을 버리고 최근 commit의 모습으로 돌아갈 때 사용한다.

실습 저장소를 준비한다.

```bash
# 새 저장소를 만든다.
mkdir git-restore-practice
cd git-restore-practice
git init

# README.md를 첫 버전으로 commit한다.
touch README.md
# 편집기에서 '# 제목입니다.'를 작성한다.
git add .
git commit -m "first commit"
```

이후 README.md에 문장을 더 작성하면 `git status`에서 `modified`이지만 아직 staged되지 않은 상태로 보인다.

```text
Changes not staged for commit:
  modified: README.md
```

수정 내용을 버리고 commit된 상태로 되돌리려면 다음을 실행한다.

```bash
# README.md의 unstaged 수정을 버린다.
git restore README.md

# 더 이상 수정 사항이 없는지 확인한다.
git status
```

결과는 다음과 같다.

```text
On branch master
nothing to commit, working tree clean
```

restore는 원래 파일 내용으로 덮어쓰는 방식이므로, 되돌린 수정 내용은 일반적인 Git 이력에서 복구할 수 없다.

⚠️ 주의: 필요한 수정이라면 먼저 commit하거나 `git diff`로 내용을 확인해야 한다. `git restore`를 실행한 뒤에는 commit하지 않은 변경을 Git으로 되찾을 수 없을 수 있다.

---

### 3.22 unstage: Staging Area에서 변경 빼기

실수로 `git add`한 변경을 다음 commit에서 제외하고 싶을 때는 unstage한다. unstage는 실제 파일 수정을 삭제하는 작업이 아니라, **Staging Area에서만 변경을 빼서 Working Directory의 수정 상태로 돌리는 작업**이다.

강의에서는 두 명령을 구분한다.

1. 기준 commit이 있을 때 사용하는 `git restore --staged`
2. 아직 첫 commit이 없을 때도 사용할 수 있는 `git rm --cached`

먼저 기존 commit이 있는 일반적인 저장소를 준비한다.

```bash
# 실습 저장소와 첫 commit을 만든다.
mkdir git-restore-staged-practice
cd git-restore-staged-practice
git init
touch README.md
git add .
git commit -m "first commit"

# README.md를 다시 수정하고 stage한다.
git add README.md
git status
```

현재 상태는 `Changes to be committed`이다. 다음 명령을 실행한다.

```bash
# README.md 변경을 Staging Area에서 내린다.
# Working Directory의 실제 수정 내용은 유지된다.
git restore --staged README.md

# modified이지만 not staged인 상태로 바뀌었는지 확인한다.
git status
```

상태 변화는 다음과 같다.

```text
실행 전: Staging Area에 README.md 변경이 있음
실행 후: Staging Area에서는 빠지고 Working Directory 수정은 남음
```

즉, `git restore README.md`와 `git restore --staged README.md`는 전혀 다르다.

| 명령 | 바꾸는 위치 | 파일 수정 내용 |
|---|---|---|
| `git restore README.md` | Working Directory | 버림 |
| `git restore --staged README.md` | Staging Area | Working Directory에 유지 |

⚠️ 주의: `--staged`를 빠뜨리면 unstage가 아니라 실제 파일 수정 취소가 될 수 있다. 명령을 실행하기 전에 `git status`에서 변경이 어느 영역에 있는지 확인해야 한다.

---

### 3.23 첫 commit 전에는 `git rm --cached`로 unstage하기

`git restore --staged`는 Staging Area를 마지막 commit, 즉 `HEAD` 기준으로 되돌린다. 저장소에 commit이 하나도 없다면 되돌아갈 기준이 없으므로 강의 환경에서는 이 명령을 사용할 수 없다.

첫 commit 전 실습 흐름은 다음과 같다.

```bash
# 아직 commit이 없는 저장소를 준비한다.
mkdir git-rm-cached-practice
cd git-rm-cached-practice
git init

# 새 파일을 stage한다.
touch README.md
git add README.md
git status
```

결과에는 `No commits yet`과 staged된 `new file: README.md`가 보인다. 이 파일을 unstage하려면 다음을 사용한다.

```bash
# index에서 README.md를 제거하지만 실제 파일은 남긴다.
git rm --cached README.md

# README.md가 untracked 상태인지 확인한다.
git status
```

예상 결과는 다음과 같다.

```text
On branch master
No commits yet

Untracked files:
  README.md
```

`git rm --cached`는 단순히 “첫 commit 전용 unstage 명령”만은 아니다. 본래 Git이 추적하는 파일을 index에서 제거하되 Working Directory에는 남기는 명령이다. 이미 commit된 파일에 실행하면 다음 commit에서 repository의 추적 대상에서 제거되고 로컬에는 untracked 파일로 남을 수 있다. `.gitignore` 적용 시 이 성질을 사용했다.

⚠️ 주의: `--cached`를 생략한 `git rm README.md`는 index뿐 아니라 Working Directory의 실제 파일도 삭제하고, 그 삭제를 stage한다. 파일을 유지하려는 상황에서는 반드시 `--cached`의 의미를 확인해야 한다.

---

### 3.24 `restore --staged`와 `rm --cached`의 선택 기준

두 명령은 실습에서 모두 `git add`를 취소하는 결과를 만들지만 출발점과 의미가 다르다.

| 기준 | `git restore --staged <file>` | `git rm --cached <file>` |
|---|---|---|
| 기본 목적 | stage된 내용을 HEAD 상태로 복원 | index에서 파일 제거 |
| 기준 commit | 필요 | 없어도 동작 |
| 실제 파일 | 유지 | `--cached`이면 유지 |
| 일반적인 unstage | 기존 commit이 있을 때 권장 | 첫 commit 전 또는 추적 제거 목적 |
| 추가 결과 가능성 | 파일은 modified로 남음 | 파일이 untracked가 될 수 있음 |

판단 흐름은 다음처럼 정리할 수 있다.

```text
단순히 방금 add한 변경을 stage에서 내리려는가?
├─ HEAD commit이 있음: git restore --staged <file>
└─ 아직 commit이 없음: git rm --cached <file>

이미 추적 중인 파일을 앞으로 Git에서 제외하려는가?
└─ .gitignore 작성 + git rm --cached <file> + commit
```

`git rm --cached`를 다른 상황에서 사용하면 원격 저장소의 다음 이력에서 파일이 제거될 수 있다. 명령 이름보다 index에서 파일을 제거한다는 본래 동작을 이해해야 한다.

---

### 3.25 `git reflog`: reset으로 보이지 않게 된 commit 찾기

`reset`으로 브랜치가 과거로 이동하면 이후 commit은 일반 `git log`에서 보이지 않을 수 있다. 하지만 Git은 로컬에서 HEAD와 브랜치가 어디를 가리켰는지 reflog에 일정 기간 기록한다.

```bash
# HEAD가 이전에 가리켰던 위치와 이동 이유를 확인한다.
git reflog
```

예상 결과는 다음과 비슷하다.

```text
1a410ef HEAD@{0}: reset: moving to 1a410ef
91cbd74 HEAD@{1}: commit: modified repo.rb a bit
f7b3a3d HEAD@{2}: commit: added repo.rb
```

복구하려는 commit id를 찾았다면 해당 위치로 다시 reset할 수 있다.

```bash
# reflog에서 찾은 commit으로 브랜치와 파일 상태를 복구한다.
git reset --hard 91cbd74
```

실행 후 `git log --oneline`과 파일 상태를 확인한다.

⚠️ 주의: reflog는 안전망이지 백업 시스템이 아니다. 로컬 저장소에만 있고 보관 기간도 영구적이지 않으며, commit하지 않은 Working Directory 변경은 reflog로 복구할 수 없다. `--hard`를 다시 실행하기 전에도 현재 변경을 잃지 않는지 확인해야 한다.

📌 핵심: reset 후 일반 로그에서 사라진 commit이라도 객체가 정리되기 전에는 reflog에서 이전 HEAD 위치를 찾아 복구할 수 있다.

---

## 4. 적용 관점에서 다시 보기

이번 강의의 명령은 “무엇을 하고 싶은가”보다 먼저 “현재 변경이 어디에 있는가”를 확인하면 훨씬 안전하게 선택할 수 있다.

가장 먼저 `git status`를 실행한다. Working Directory에만 수정이 있는지, Staging Area에 올라갔는지, 이미 commit되었는지에 따라 다음 명령이 달라진다. commit 이력을 볼 때는 `git log --oneline`, 원격 연결을 볼 때는 `git remote -v`를 함께 사용한다.

원격 저장소와 작업할 때는 다음 신호로 판단한다.

| 상황 | 떠올릴 동작 |
|---|---|
| 새 GitHub repository와 기존 로컬 저장소를 연결 | `git remote add origin <url>` |
| 로컬의 새 commit을 원격에 공유 | `git push` |
| 원격 프로젝트를 컴퓨터에 처음 받음 | `git clone` |
| 이미 받은 프로젝트를 최신 상태로 갱신 | `git pull` |
| 특정 파일이 `git status`에 나타나지 않게 함 | `.gitignore` |

되돌리기 상황에서는 공유 여부와 Git 영역을 차례로 본다.

| 상황 | 적합한 명령 |
|---|---|
| 이미 공유한 commit의 변경을 안전하게 취소 | `git revert <commit>` |
| 공유 전 로컬 commit 이력을 과거로 이동 | `git reset`의 적절한 옵션 |
| 직전 commit 메시지 또는 포함 파일 수정 | `git commit --amend` |
| stage 전 파일 수정 자체를 버림 | `git restore <file>` |
| stage만 취소하고 파일 수정은 유지 | `git restore --staged <file>` |
| 첫 commit 전 새 파일의 stage 취소 | `git rm --cached <file>` |
| reset으로 일반 로그에서 사라진 commit 탐색 | `git reflog` |

reset 옵션은 변경을 어디에 남길지로 고른다.

- 바로 새 commit을 만들 수 있게 staged 상태로 남기려면 `--soft`를 사용한다.
- 변경을 다시 검토하고 골라 stage하려면 기본값인 `--mixed`를 사용한다.
- commit 이후 변경까지 모두 버리고 정확히 과거 상태로 맞추려면 위험을 확인한 뒤 `--hard`를 사용한다.

실전에서는 명령 실행 전후 검증을 습관화한다.

```bash
# 1. 실행 전: 세 영역과 브랜치 상태를 확인한다.
git status
git log --oneline --decorate -5

# 2. 목적에 맞는 한 명령을 실행한다.
# 예: git restore --staged README.md

# 3. 실행 후: 기대한 영역만 바뀌었는지 다시 확인한다.
git status
git log --oneline --decorate -5
```

특히 `reset --hard`, `restore`, `rm`, `amend`는 잘못 선택하면 작업 내용이나 공유 이력에 영향을 준다. 명령을 빠르게 입력하는 것보다 현재 브랜치, 대상 commit id, 파일 상태를 한 번 더 확인하는 것이 중요하다.

---

## 5. 배운 점 / 확장 포인트

### 5.1 이번 강의 이전에 몰랐던 것 또는 새로 이해된 것

원격 저장소에는 단순히 현재 파일이 복사되는 것이 아니라 commit 이력이 공유되며, `clone`과 `pull`은 처음 전체를 복제하는 작업과 이미 있는 저장소를 갱신하는 작업으로 구분된다. 또한 되돌리기는 하나의 기능이 아니라 공개 이력을 보존하는 `revert`, 로컬 이력을 옮기는 `reset`, commit 전 영역을 조정하는 `restore`처럼 대상에 따라 나뉜다는 점을 이해할 수 있다.

### 5.2 앞으로 이어지는 연결점

원격 브랜치와 upstream의 이해는 이후 branch, merge, pull request, 협업 충돌 해결로 이어진다. `git status`로 세 영역을 구분하는 습관은 여러 사람이 같은 파일을 수정했을 때 충돌을 분석하고 안전하게 commit을 구성하는 기반이 된다.

### 5.3 더 파볼 만한 주제

다음으로는 `fetch`와 `pull`의 차이, branch 추적 관계, merge와 rebase, stash, reflog 보관 방식, 공개 저장소에서 비밀 값을 제거하는 이력 정리 방법을 살펴볼 수 있다. GitHub 측면에서는 pull request, code review, issue, branch protection도 자연스럽게 연결되는 주제다.

---

## 6. 요약 정리

📌 핵심

- 원격 저장소는 코드와 Git 이력을 온라인에서 공유하는 저장 공간이다.
- Git은 버전 관리 도구이고, GitHub는 Git 저장소를 호스팅하는 서비스이다.
- `git remote add origin <url>`은 로컬 저장소에 원격 URL과 별칭을 등록한다.
- `push`는 로컬 commit을 원격에 올리고, `clone`은 저장소 전체를 처음 복제하며, `pull`은 이미 가진 저장소를 갱신한다.
- `.gitignore`는 아직 추적하지 않는 파일을 Git의 추적 대상에서 제외한다.
- `revert`는 반대 변경을 새 commit으로 남기므로 공유 이력 취소에 적합하다.
- `reset`은 브랜치를 과거 commit으로 옮기며, `--soft`·`--mixed`·`--hard`는 변경을 남길 영역이 다르다.
- `amend`는 바로 직전 commit의 메시지나 포함 내용을 교체한다.
- `restore`는 Working Directory 수정을 버리거나 `--staged`와 함께 stage를 취소한다.
- 첫 commit 전에는 `git rm --cached`로 새 파일을 unstage할 수 있다.
- reset으로 로그에서 사라진 commit은 `git reflog`에서 이전 HEAD 위치를 찾아 복구할 수 있다.

🧠 기억할 것

Git에서 명령을 고르는 가장 안전한 순서는 **현재 상태 확인 → 변경 위치 확인 → 공유 여부 확인 → 명령 실행 → 결과 재확인**이다. 특히 Working Directory, Staging Area, Local Repository, Remote Repository 중 어디를 바꾸는 명령인지 설명할 수 있어야 한다.

---

## 7. 미니 퀴즈 또는 체크리스트

1. Git과 GitHub의 차이를 각각 한 문장으로 설명할 수 있는가?
2. 프로젝트를 처음 받을 때 `clone`, 이미 받은 프로젝트를 갱신할 때 `pull`을 쓰는 이유를 설명할 수 있는가?
3. 파일만 수정하고 commit하지 않은 상태에서 `git push`를 실행해도 그 수정이 올라가지 않는 이유는 무엇인가?
4. 이미 원격에 공유한 잘못된 commit을 `reset`보다 `revert`로 취소해야 하는 이유는 무엇인가?
5. `reset --soft`, `--mixed`, `--hard` 실행 후 변경이 각각 어느 영역에 남는지 설명할 수 있는가?
6. `git restore README.md`와 `git restore --staged README.md`는 무엇을 다르게 바꾸는가?
7. 아직 commit이 하나도 없는 저장소에서 staged된 새 파일을 어떻게 unstage할 수 있는가?
8. `.gitignore`에 적었는데도 파일이 계속 추적된다면 어떤 이력을 먼저 의심해야 하는가?
9. `git commit --amend` 후 commit hash가 바뀌는 이유를 설명할 수 있는가?
10. `reset --hard`로 일반 로그에서 사라진 commit을 찾을 때 어떤 명령을 사용할 수 있는가?
