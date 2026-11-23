# Maintainer verification

Verified on 2026-11-18, Ubuntu CPU, Python 3.12.16, NumPy 2.5.5.
Python 3.10 compatibility is by syntax/API choice, not a second interpreter run.
Run all commands from this project directory. No dependency besides NumPy is
needed; the Python tests are not part of `npm run check`.

## Solution and full-run timing

```sh
/usr/bin/time -f 'solution wall_seconds=%e' env PYTHONDONTWRITEBYTECODE=1 INKMIND_IMPL=solution python3 -m unittest -v
```

Trimmed output:

```text
Ran 19 tests in 0.828s

OK
held-out preference accuracy=0.7661 (required >0.70)
RLHF true score: reference=0.8680, initial=1.1323, KL=1.3968, no-KL=-9.1960; spam probability: KL=0.0074, no-KL=0.9997; learned reward: KL=1.4081, no-KL=5.3462
RLVR sampled-answer accuracy: before=0.1429, after=0.9963 (required >0.95)
solution wall_seconds=1.06
```

Exit 0. The timed command includes all unit/integration tests, reward-model
training, both RLHF runs, RLVR training and interpreter startup.
There are 16 core tests and 3 integration tests.

## Blank starter and files-only export

The following audit is also the exact reproduction command for both negative
checks. It copies only the six manifest export files, verifies no solution
package is present, and checks that all 19 errors are `NotImplementedError`,
not missing imports or unrelated exceptions. Temporary export files are removed.

```sh
python3 - <<'PY'
import json, os, pathlib, re, shutil, subprocess, tempfile
root = pathlib.Path.cwd()
manifest = json.loads((root / "project.json").read_text())
for name, directory in [
    ("starter", root),
    ("export", pathlib.Path(tempfile.mkdtemp(prefix="inkmind-export-"))),
]:
    try:
        if name == "export":
            for filename in manifest["files"]:
                target = directory / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / filename, target)
            print("export files copied:", len(manifest["files"]))
            print("solution present:", (directory / "solution").exists())
        result = subprocess.run(
            ["python3", "-m", "unittest", "-v"], cwd=directory,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1", "INKMIND_IMPL": "starter"},
            capture_output=True, text=True,
        )
        output = result.stdout + result.stderr
        errors = re.findall(r"^([A-Za-z]+Error):", output, re.M)
        print(name + " exit:", result.returncode)
        print("exception types:", sorted(set(errors)))
        print("\n".join(output.splitlines()[-4:]))
        assert result.returncode == 1 and errors == ["NotImplementedError"] * 19
    finally:
        if name == "export":
            shutil.rmtree(directory)
PY
```

Observed output (audit exits 0; each intentionally blank test run exits 1):

```text
starter exit: 1
exception types: ['NotImplementedError']
----------------------------------------------------------------------
Ran 19 tests in 0.040s

FAILED (errors=19)
export files copied: 6
solution present: False
export exit: 1
exception types: ['NotImplementedError']
----------------------------------------------------------------------
Ran 19 tests in 0.040s

FAILED (errors=19)
```

Thus the blank exercise has zero assertion failures and 19 expected errors.
No solution files, project manifest or repository imports are needed by the
standalone default test command.

## InkMind manifest and TypeScript checks

From the repository root:

```sh
source ~/.nvm/nvm.sh && nvm use 22
npm run lint
npx vitest run src/path
npx tsc -b
```

Lint exited 0 with 16 existing warnings in untouched files and no warnings in
changed files. Vitest reported:

```text
 Test Files  5 passed (5)
      Tests  103 passed (103)
```

This includes assertions that `validateProjects(mlMap, starterProjects)` and
`await checkProjectFiles(starterProjects)` both equal `[]`, plus reason-format
tests. TypeScript exited 0 without diagnostics.
