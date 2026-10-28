# Failure patterns from test rounds

Each pattern has the symptom, the cause and the rule that fixed it. Use the list as a checklist when you design or review a workflow.

## Planner

- **A summary without files.** The planner returned `status: complete` and paths, and the folder was empty. Rule: the planner writes the files, runs `ls`, and only then returns. The lead checks with `ls` too.
- **A false dependency.** A task got `Depends on` only because its phase came later. Independent units became a stack, and no team criterion passed. Rule: a dependency names a shared file or a shared symbol, never the order of phases. Write the line on every task.
- **A claim of absence without a search.** The plan said that a component did not exist, and the repo already used it. A unit was built twice. Rule: search with `grep` over the source and the installed library, and name the search in the spec.
- **A conditional split.** The plan said "if X does not resolve, split into a stacked PR". The question reached the user in the middle of the run. Rule: a plan has one structure. A condition goes to the gate as an open question.
- **A rule of the repo found late.** A reviewer cited a repo rule that the plan did not read. Rule: the planner reads the rule files that match what the feature touches.
- **Task text that cannot pass.** A `done when` greps a whole module and finds files that no task owns. Rule: a grep stays inside the files of the task.

## Teammates

- **Done after the task test only.** A teammate reported the unit after the test of one task, not after the full verify. Rule: a verdict carries the full verify table. The first line of the commit report carries the full SHA.
- **Test-first skipped without a word.** Rule: the report has a `tdd:` line, and a "no" is recorded as a note.
- **A subagent in the wrong tree.** See `claude-code-lessons.md`. Rule: a teammate never starts a subagent. The lead dispatches it with the unit path.
- **Three heavy suites at once.** A JVM stopped with an out-of-memory error. The same suite alone passed. Rule: at most two heavy suites at once in one repo, with a lock.
- **An install that did not run.** The first install ended with no output and was reported as done. Rule: done means exit code 0 and a non-empty dependency folder.
- **Ship and build in one teammate.** The pull request of a unit waited for the next build of the same teammate. In a stack the children waited too. Rule: a `ship` message goes first. Measure the delay again before you add a rule.

## Lead

- **A check after the verify.** A security scan ran after the verify and held a pull request for six minutes. Rule: run it when the unit is committed, in parallel with the verify. The ship message carries the result.
- **A narrow default.** The recommendation to add a label held only when the spec had added scope. An auto-merge workflow merged ready pull requests a minute after the review. Rule: recommend the safe option for every repo that has the workflow.
- **Noise.** The lead wrote a line for each idle notice. Rule: one line for each verdict and each pull request. Do not resend a message because an idle notice crossed it.
- **A login that expired.** The cloud login expired after the gate. Rule: run the login checks before the planner, and again before the dispatch.
- **Offers without an answer.** The lead wrote "tell me if you want X" and shipped 50 seconds later. Rule: ask and wait, or do X without asking.
- **Fixed costs measured on one stack.** The minutes of verify and ship were measured on one repo and overstated another. Rule: keep the number for each stack family.

## Process

- **A stale checkout at the tester.** An old rule fired after it was removed. Rule: pull before each round.
- **An edit during a run.** Rule: do not edit files a running session reads.
- **Edits without a test.** Many small commits with no test. Rule: one test round, then one commit.
- **A review finding about a mode that never ran.** The reviewer read the text of a mode and found missing data (the owner of a unit when no task list exists). Rule: for each mode, list the data the lead needs after a context compaction and check that the ledger holds it.
