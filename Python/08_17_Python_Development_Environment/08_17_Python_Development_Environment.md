# Windows에서 Python 개발환경 이해하기: PowerShell, Conda, PEP 8

- 🎯 글의 목표: Windows에서 Python 프로젝트를 시작할 때 만나는 터미널 실행 정책, Conda 가상환경, 환경 정의 파일, 코드 스타일의 역할을 하나의 흐름으로 이해한다.
- 🧩 핵심 키워드: PowerShell, Execution Policy, profile.ps1, Conda, Anaconda, Miniconda, Miniforge, 가상환경, environment.yml, PEP 8
- ⭐ 중요도: ★★★★★ — 개발환경이 섞이면 코드가 맞아도 실행되지 않으며, 오류 원인을 코드에서만 찾게 되기 때문이다.
- 📝 한눈에 보는 내용: PowerShell은 명령을 실행하는 창이고, 실행 정책은 스크립트 실행 조건을 정한다. Conda는 프로젝트별 Python과 패키지를 격리하며, `environment.yml`은 그 환경을 다시 만드는 설명서다. PEP 8은 실행 여부가 아니라 Python 코드를 일관되게 읽도록 돕는 스타일 기준이다.
- 🔗 관련 주제: Python 패키지 설치, `pip`, `venv`, 의존성 재현, VS Code 인터프리터 선택
- 🧱 선수 지식: 파일과 폴더, 터미널 명령의 기본 구조

---

## 1. 들어가며

Python을 처음 실행할 때는 코드보다 개발환경에서 더 자주 막힐 수 있다. 같은 `python` 명령인데 프로젝트마다 버전이 다르고, 설치한 패키지를 찾지 못하거나, PowerShell을 열자마자 `profile.ps1`을 실행할 수 없다는 오류가 나오기도 한다.

이 문제들은 서로 비슷해 보이지만 책임이 다르다.

```text
PowerShell
  └─ 명령과 스크립트를 실행하는 터미널 환경

Conda
  └─ Python 버전과 패키지를 프로젝트별로 격리하는 도구

PEP 8
  └─ Python 코드를 일관되게 읽도록 돕는 스타일 가이드
```

따라서 오류가 생기면 먼저 “터미널이 스크립트를 막은 것인지”, “다른 Python 환경을 사용한 것인지”, “단순한 코드 스타일 문제인지”를 구분해야 한다.

## 2. 핵심 개념 정리

Python 프로젝트를 실행하는 흐름은 다음과 같다.

```text
PowerShell에서 명령 입력
        ↓
원하는 Conda 환경 활성화
        ↓
그 환경의 Python과 패키지 사용
        ↓
Python 코드 실행
        ↓
PEP 8과 프로젝트 규칙으로 코드 품질 유지
```

PowerShell 실행 정책과 Conda 가상환경은 모두 “환경”과 관련 있지만 같은 기능이 아니다. 실행 정책은 PowerShell 스크립트를 불러올 수 있는 조건을 정하고, Conda는 어떤 Python 실행 파일과 패키지를 사용할지 결정한다.

## 3. 본문 정리

### 3.1 PowerShell과 `profile.ps1`

PowerShell은 Windows에서 명령을 실행하고 자동화 스크립트를 작성할 수 있는 셸이다. 셸은 사용자가 입력한 명령을 운영체제에 전달하는 프로그램이다.

`profile.ps1`은 PowerShell이 시작될 때 자동으로 읽을 수 있는 개인 설정 스크립트다. 별칭, 환경 변수, 프롬프트 모양, Conda 초기화 코드 등이 들어갈 수 있다.

```text
PowerShell 시작
      ↓
profile.ps1 로드 시도
      ↓
개인 설정과 초기화 명령 적용
```

따라서 아래와 같은 오류는 Python 코드 오류가 아니다.

```text
PSSecurityException
이 시스템에서 스크립트를 실행할 수 없으므로 profile.ps1 파일을 로드할 수 없습니다.
```

PowerShell이 시작 스크립트를 현재 실행 정책상 허용하지 않았다는 뜻이다.

### 3.2 실행 정책은 보안 경계가 아니라 안전장치다

실행 정책(Execution Policy)은 PowerShell이 설정 파일과 스크립트를 어떤 조건에서 불러올지 정한다. Microsoft 문서도 실행 정책을 악성 코드를 완전히 차단하는 보안 시스템이 아니라, 사용자가 의도하지 않은 스크립트를 실수로 실행하지 않도록 돕는 안전 기능으로 설명한다.

대표 정책은 다음과 같다.

| 정책 | 의미 | 초보자가 기억할 점 |
| --- | --- | --- |
| `Restricted` | 개별 명령은 허용하지만 스크립트는 실행하지 않는다. | `profile.ps1` 로드가 막힐 수 있다. |
| `RemoteSigned` | 로컬 스크립트는 허용하고, 인터넷에서 받은 스크립트는 서명 또는 차단 해제를 요구한다. | 개인 개발 PC에서 자주 선택한다. |
| `AllSigned` | 로컬·원격 구분 없이 모든 스크립트에 신뢰된 서명을 요구한다. | 관리가 더 엄격하다. |
| `Bypass` | 차단과 경고를 적용하지 않는다. | 이유 없이 장기간 사용하지 않는다. |

현재 적용 상태는 변경하기 전에 먼저 확인한다.

```powershell
# 각 범위에 설정된 정책을 모두 확인한다.
Get-ExecutionPolicy -List

# 현재 세션에 실제로 적용되는 정책만 확인한다.
Get-ExecutionPolicy
```

정책에는 적용 범위가 있다.

| 범위 | 지속 시간과 대상 |
| --- | --- |
| `Process` | 현재 PowerShell 세션에만 적용되고 창을 닫으면 사라진다. |
| `CurrentUser` | 현재 Windows 사용자에게 계속 적용된다. |
| `LocalMachine` | 컴퓨터의 모든 사용자에게 적용되며 일반적으로 관리자 권한이 필요하다. |
| `MachinePolicy`, `UserPolicy` | 조직의 그룹 정책으로 관리될 수 있으며 다른 설정보다 우선한다. |

개인 계정 범위에서 로컬 스크립트를 실행하도록 설정하는 예는 다음과 같다.

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

현재 창에서만 임시로 정책을 바꾸는 예는 다음과 같다.

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

⚠️ 주의: 오류가 보인다는 이유만으로 바로 `Bypass`를 영구 설정하거나 인터넷에서 받은 파일을 무조건 `Unblock-File`로 해제하면 안 된다. 먼저 스크립트의 출처와 내용을 확인해야 한다.

또한 명령이 성공했는데도 정책이 바뀌지 않은 것처럼 보이면 `MachinePolicy` 또는 `UserPolicy`가 더 높은 우선순위로 적용되는지 확인한다.

### 3.3 Anaconda, Miniconda, Miniforge, Conda의 차이

이 이름들은 같은 종류처럼 보여도 역할이 다르다.

| 이름 | 역할 |
| --- | --- |
| Conda | 패키지와 가상환경을 관리하는 명령줄 도구 |
| Anaconda Distribution | Conda, Python, 데이터 과학 패키지를 넓게 포함한 배포판 |
| Miniconda | Conda와 최소 구성만 제공하는 가벼운 배포판 |
| Miniforge | `conda-forge` 중심으로 구성된 Conda 배포판 |

💡 이해 포인트: Conda가 “환경을 관리하는 도구”라면 Anaconda·Miniconda·Miniforge는 그 도구를 설치하고 사용하는 서로 다른 배포 방식이다.

### 3.4 가상환경이 필요한 이유

가상환경은 프로젝트마다 Python과 패키지를 분리한 작업 공간이다.

```text
프로젝트 A
  ├─ Python 3.x
  └─ package-x 1.x

프로젝트 B
  ├─ Python 3.y
  └─ package-x 2.x
```

한 전역 환경에 모두 설치하면 A가 요구하는 버전과 B가 요구하는 버전이 충돌할 수 있다. 가상환경을 사용하면 각 프로젝트가 자기 환경 안의 실행 파일과 패키지를 사용한다.

새 환경을 만들고 확인하는 기본 흐름은 다음과 같다.

```powershell
# 이름이 study-env인 환경을 특정 Python 버전과 함께 만든다.
conda create --name study-env python=3.11

# 환경을 활성화한다.
conda activate study-env

# 현재 설치된 환경 목록을 확인한다.
conda env list

# 어떤 Python 실행 파일을 사용하는지 확인한다.
Get-Command python

# Python 버전을 확인한다.
python --version
```

환경을 활성화했다는 사실만 믿지 말고 `Get-Command python`과 `python --version`으로 실제 실행 대상을 확인하는 습관이 중요하다.

### 3.5 `environment.yml`로 환경 재현하기

`environment.yml`은 환경 이름, 패키지 채널, Python과 라이브러리 의존성을 기록하는 파일이다.

```yaml
name: nlp-study
channels:
  - conda-forge
dependencies:
  - python=3.11
  - numpy
  - pandas
  - pip
  - pip:
      - transformers
```

이 파일을 사용하면 다른 컴퓨터에서도 비슷한 개발환경을 만들 수 있다.

```powershell
conda env create -f environment.yml
```

자주 헷갈리는 옵션을 분리해서 보면 이해하기 쉽다.

```powershell
conda env create -f nlp.yaml -n nlp-study
```

| 옵션 | 긴 이름 | 의미 |
| --- | --- | --- |
| `-f` | `--file` | 읽을 환경 정의 파일의 경로 |
| `-n` | `--name` | 새로 만들 환경의 이름 |

`nlp.yaml` 안에 `name:`이 있어도 CLI의 `-n`으로 지정한 이름이 우선할 수 있다. Conda 버전에 따라 권장 명령 표현이 보완될 수 있으므로, 자동화 스크립트를 작성할 때는 사용하는 Conda 버전의 도움말도 확인한다.

```powershell
conda env create --help
```

### 3.6 환경 파일은 완전한 복제 보증서가 아니다

YAML 환경 파일은 협업에 유용하지만 운영체제, CPU 아키텍처, 채널 상태에 따라 실제 설치 결과가 조금 달라질 수 있다. 완전히 같은 빌드가 필요하면 플랫폼과 패키지 빌드가 고정된 lock 또는 explicit spec 방식도 검토한다.

초보 단계에서는 다음을 먼저 지키면 된다.

1. 프로젝트마다 환경을 분리한다.
2. Python의 주요·부 버전을 기록한다.
3. 필요한 직접 의존성만 환경 파일에 남긴다.
4. 새 환경에서 실제로 다시 만들어 본다.
5. README에 생성·활성화·실행 명령을 적는다.

### 3.7 PEP 8은 무엇을 해결하는가

PEP 8은 Python 코드의 대표적인 스타일 가이드다. 문법 규칙과 다르게 PEP 8을 어겼다고 항상 실행 오류가 생기는 것은 아니다. 목적은 여러 사람이 코드를 읽을 때 모양 때문에 해석이 느려지는 일을 줄이는 것이다.

대표 기준은 다음과 같다.

- 들여쓰기는 공백 4칸을 사용한다.
- 함수와 변수는 `snake_case`를 사용한다.
- 클래스는 `CapWords` 형태를 사용한다.
- 상수는 `UPPER_CASE_WITH_UNDERSCORES` 형태를 사용한다.
- import는 보통 표준 라이브러리, 외부 패키지, 로컬 모듈 순으로 그룹화한다.
- 주석은 코드가 이미 말하는 내용을 반복하기보다 이유와 주의점을 설명한다.

```python
MAX_RETRY_COUNT = 3


class ApiClient:
    def fetch_user_profile(self, user_id: int) -> dict[str, object]:
        """사용자 식별자로 프로필 데이터를 조회한다."""
        return {"user_id": user_id}
```

PEP 8의 줄 길이 기준은 기본적으로 코드 79자, 주석과 docstring 72자지만, 팀이 합의한 도구 설정에 따라 더 긴 기준을 사용할 수도 있다. 중요한 것은 숫자를 무조건 따르는 것보다 프로젝트 전체가 같은 기준을 사용하도록 formatter와 linter 설정을 공유하는 것이다.

## 4. 적용 관점에서 다시 보기

### 오류를 만났을 때 확인 순서

```text
1. 오류가 PowerShell 시작 시 발생하는가?
   └─ profile.ps1과 실행 정책 확인

2. python 또는 패키지를 찾지 못하는가?
   └─ Conda 환경 활성화와 실제 Python 경로 확인

3. 다른 컴퓨터에서만 설치가 실패하는가?
   └─ environment.yml, 채널, 플랫폼, Python 버전 확인

4. 실행은 되지만 코드 형태가 제각각인가?
   └─ PEP 8과 프로젝트 formatter/linter 설정 확인
```

### VS Code에서 환경이 맞지 않을 때

터미널에서 Conda 환경을 활성화했어도 VS Code가 다른 인터프리터를 선택할 수 있다. 상태 표시줄 또는 명령 팔레트의 Python 인터프리터 선택 기능에서 환경 경로를 확인하고, VS Code 터미널을 새로 연 뒤 다시 검사한다.

### 전역 설치를 먼저 의심하지 않기

`ModuleNotFoundError`가 발생했을 때 무조건 `pip install`을 다시 실행하면 다른 환경에 패키지가 설치될 수 있다. 다음처럼 현재 Python과 연결된 pip를 사용하는 편이 대상을 분명하게 만든다.

```powershell
python -m pip --version
python -m pip install package-name
```

## 5. 배운 점 / 확장 포인트

### 5.1 새로 이해한 것

- PowerShell 실행 정책과 Python 가상환경은 서로 다른 계층의 설정이다.
- `-f`는 환경 파일, `-n`은 환경 이름을 지정한다.
- 환경 활성화 메시지보다 실제 Python 경로 확인이 더 확실하다.
- PEP 8은 실행을 위한 문법이 아니라 협업과 유지보수를 위한 읽기 규칙이다.

### 5.2 이전·다음 학습과의 연결

이 내용은 `pip`, `venv`, 패키지 버전 충돌, Docker, CI 환경 재현으로 이어진다. 프로젝트가 커질수록 “내 컴퓨터에서만 실행되는 환경”보다 “다른 사람이 다시 만들 수 있는 환경”이 더 중요해진다.

### 5.3 더 확인할 주제

- Conda와 Python 표준 `venv`의 차이
- `environment.yml`과 `requirements.txt`의 책임
- formatter인 Black과 linter인 Ruff의 차이
- lock file과 재현 가능한 빌드

## 6. 요약 정리

1. PowerShell은 명령과 스크립트를 실행하는 셸이다.
2. `profile.ps1` 오류는 Python 코드가 아니라 PowerShell 실행 정책 문제일 수 있다.
3. 정책을 바꾸기 전 `Get-ExecutionPolicy -List`로 모든 범위를 확인한다.
4. `Process` 범위는 현재 세션에만, `CurrentUser`는 현재 사용자에게 계속 적용된다.
5. Conda는 패키지 관리자이면서 가상환경 관리자다.
6. Anaconda·Miniconda·Miniforge는 Conda를 제공하는 배포 방식이다.
7. `-f`는 환경 파일, `-n`은 환경 이름이다.
8. 환경을 활성화한 뒤 실제 Python 경로와 버전을 확인한다.
9. PEP 8은 Python 코드의 일관성과 가독성을 높이는 스타일 가이드다.

🧠 기억할 것: 터미널, 가상환경, 코드 스타일은 모두 개발환경의 일부지만 서로 다른 문제를 해결한다.

## 7. 미니 퀴즈 또는 체크리스트

1. `profile.ps1`이 차단되었을 때 Python 코드를 먼저 수정하면 안 되는 이유는 무엇인가?
2. `Process`와 `CurrentUser` 실행 정책 범위는 어떻게 다른가?
3. `conda env create -f nlp.yaml -n nlp-study`에서 두 옵션은 각각 무엇을 지정하는가?
4. 가상환경을 활성화한 뒤 어떤 명령으로 실제 Python 경로를 확인할 수 있는가?
5. PEP 8 위반과 Python 문법 오류는 어떻게 다른가?

<details>
<summary>정답과 해설</summary>

1. `profile.ps1` 차단은 PowerShell이 스크립트를 불러오는 단계의 문제이므로 Python 코드 실행 이전에 발생한다.
2. `Process`는 현재 창을 닫으면 사라지고, `CurrentUser`는 현재 사용자 설정으로 유지된다.
3. `-f`는 환경 정의 파일, `-n`은 생성할 환경 이름을 지정한다.
4. PowerShell에서는 `Get-Command python`으로 실제 명령 경로를 확인할 수 있다.
5. 문법 오류는 실행 자체를 막을 수 있지만, PEP 8은 주로 가독성과 일관성에 관한 스타일 기준이다.

</details>

## 참고 자료

- [Microsoft Learn: PowerShell 실행 정책](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)
- [Conda: 환경 관리](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html)
- [Conda: `conda env create`](https://docs.conda.io/projects/conda/en/latest/commands/env/create.html)
- [PEP 8: Style Guide for Python Code](https://peps.python.org/pep-0008/)
