---
title: Java mid-level interview quiz (10 questions)
description: Ten multiple-choice questions on core Java topics—collections, concurrency basics, OOP, and JVM fundamentals—for mid-level backend interviews.
pubDate: 2026-05-28
type: static-quiz
tags:
  - Java
  - Mid-level
  - Backend
---

Use these questions to warm up before a mid-level Java interview. Answers are listed at the end.

## Questions

**1.** Which collection guarantees insertion order and allows duplicate elements?

- A) `HashSet`
- B) `ArrayList`
- C) `TreeMap`
- D) `PriorityQueue`

**2.** What does `volatile` guarantee for a field?

- A) Atomic read-modify-write operations
- B) Visibility of writes across threads
- C) Mutual exclusion like a lock
- D) Immutability of the reference

**3.** Which statement about `String` in Java is true?

- A) `String` is mutable when created with `new String("x")`
- B) String literals may be interned in the string pool
- C) `StringBuilder` is always slower than `+` in loops
- D) `equals` on strings compares references only

**4.** In Java 17+, which keyword can define a class that is implicitly final and cannot extend other classes?

- A) `interface`
- B) `enum`
- C) `record`
- D) `sealed` alone without permits

**5.** What happens if an unchecked exception is thrown inside a `try` block and not caught?

- A) The JVM exits immediately
- B) It propagates to the caller if not caught by a matching `catch`
- C) It is always wrapped in `IOException`
- D) It is ignored if `finally` runs

**6.** Which is the best default choice for a method parameter that must not be reassigned inside the method?

- A) Mark the parameter `volatile`
- B) Use a primitive only
- C) Rely on convention; parameters are already effectively final for reassignment
- D) Clone the argument defensively always

**7.** `ExecutorService` is primarily used to:

- A) Serialize objects to JSON
- B) Manage a pool of threads for asynchronous tasks
- C) Replace `synchronized` entirely
- D) Compile bytecode at runtime

**8.** Which access modifier allows package-private visibility?

- A) `public`
- B) `protected`
- C) (no modifier / default)
- D) `private`

**9.** For `Map<String, Integer> counts`, which loop avoids boxing issues when summing values if you only need entries?

- A) `for (Integer v : counts.values())` only
- B) `counts.forEach((k, v) -> ...)` or entry set iteration
- C) Indexed loop on key array
- D) `Stream.of(counts)` without flattening

**10.** What does the JVM guarantee about `finalize()` (deprecated)?

- A) It runs exactly once before every GC
- B) It may never run; do not rely on it for cleanup
- C) It replaces try-with-resources
- D) It runs on a user thread synchronously

## Answers

1. **B** — `ArrayList` preserves insertion order and allows duplicates.
2. **B** — `volatile` ensures visibility; it does not make compound updates atomic.
3. **B** — Literals and interned strings share the pool when interned.
4. **C** — `record` is a compact carrier for immutable data.
5. **B** — Unchecked exceptions propagate unless caught.
6. **C** — Parameters cannot be reassigned to point elsewhere (object mutation may still occur).
7. **B** — Executors manage thread pools and task submission.
8. **C** — Default (package-private) visibility is no modifier.
9. **B** — Entry iteration avoids extra intermediate structures when written clearly.
10. **B** — `finalize` is unreliable; use try-with-resources and explicit cleanup.
