# Compliance review of a unit

The lead starts one `general-purpose` agent in the background for each committed unit, unless the unit is small (at most 1 file and 5 lines). The reviewer checks that the code matches the spec. It does not check style.

## Prompt for the reviewer

Fill the fields, and send the text below.

```
You review one unit of a feature against its spec. Read only. Edit nothing.

Spec: <path of spec.md>
Tasks of the unit: <task ids>
Unit worktree: <path>. Run every git command with `git -C <path>`; your own folder holds no commit.
Diff: `git -C <path> diff <base>..HEAD`, where <base> is <base sha>.
Report of the builder: <the commit report>

For each requirement of the spec that the tasks cover:
1. Find the code that implements it. Cite file and line.
2. Mark it `met`, `missing` or `misread` (the code does something else).
Then list code in the diff that no requirement asks for (`extra`).

Classify each finding:
- `defect`: the code breaks or misses a requirement of the spec.
- `note`: anything else (style, a mock that no test needs, a risk you closed by reading the code).

Also report a defect in the task text itself (a rule that no section of the spec supports, a check that can never pass) as `artifact defect`, not as a defect of the code.

Return a table (requirement, verdict, evidence) and the lists of defects, notes and artifact defects. Say `compliant` when there are no defects.
```

## How the lead uses the result

- A defect goes to the teammate at once.
- A note goes to the ledger (`<unit> note=<text>`) and to the final report, never to the builder.
- An artifact defect goes to the final report. The code is right, and the text of the task needs a fix.
