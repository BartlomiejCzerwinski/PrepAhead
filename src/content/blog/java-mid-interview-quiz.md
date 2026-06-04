---
title: Java backend interview quiz (10 questions)
description: Ten realistic Java interview questions for mid-level backend engineers, covering collections, concurrency, language features, exception handling, and core API choices.
pubDate: 2026-05-28
type: interactive-quiz
tags:
  - Java
  - Mid-level
  - Backend
relatedSlugs:
  - java-collections-quick-quiz
  - behavioral-system-design-prompts
quiz:
  - question: You need an ordered collection that allows duplicates and is usually read by index. Which type is the best default choice?
    options:
      - HashSet
      - ArrayList
      - TreeMap
      - PriorityQueue
    correctIndex: 1
    answer: ArrayList is the best default choice when order matters, duplicates are allowed, and indexed reads are common.
    explanation: ArrayList preserves insertion order, allows duplicates, and gives O(1) indexed access. HashSet removes duplicates. TreeMap is a key-value structure, not a List. PriorityQueue orders by priority rather than preserving insertion order.
    interviewNotes: Interviewers often follow up by asking when LinkedList is preferable. A strong answer mentions queue-like operations or frequent inserts/removes at known positions, not random access.
  - question: A boolean stop flag is written by one thread and read by another, and you do not need compound atomic updates. What does volatile give you here?
    options:
      - Atomic increment and decrement
      - Visibility of writes across threads
      - Mutual exclusion like synchronized
      - Deep immutability of the field value
    correctIndex: 1
    answer: volatile gives you visibility of writes across threads.
    explanation: A volatile write becomes visible to other threads that read the same field. It does not make compound operations like count++ atomic, and it does not replace locking when multiple operations must happen together safely.
    interviewNotes: A common follow-up is how volatile differs from synchronized or AtomicInteger.
  - question: Which statement about String in Java is correct?
    options:
      - String becomes mutable when created with new String("x")
      - String literals may be interned in the string pool
      - StringBuilder is always slower than + inside loops
      - equals on String compares object identity only
    correctIndex: 1
    answer: String literals may be interned in the string pool.
    explanation: String is immutable regardless of how it is constructed. equals compares content, while == compares references. In loops, StringBuilder is usually preferred over repeated + because it avoids many intermediate String allocations.
    interviewNotes: Strong candidates can explain when intern() is useful and why overusing it is rarely necessary in application code.
  - question: In Java 17+, you need a compact type for an immutable response object that is mostly data. Which feature is the best fit?
    options:
      - interface
      - enum
      - record
      - abstract class
    correctIndex: 2
    answer: record is the best fit for a compact immutable data carrier.
    explanation: Records are ideal for simple data-focused models because they generate accessors, constructor, equals, hashCode, and toString automatically. enum models a fixed set of constants. interface and abstract class solve different design problems.
    interviewNotes: A good follow-up is when not to use a record, for example when the type has substantial mutable state or complicated lifecycle rules.
  - question: What happens when an unchecked exception is thrown in a method and no matching catch handles it there?
    options:
      - The JVM exits immediately
      - It propagates to the caller
      - It is automatically wrapped in IOException
      - It is ignored if finally executes
    correctIndex: 1
    answer: The exception propagates to the caller until some frame handles it or the thread terminates.
    explanation: Runtime exceptions do not need to be declared, but they still follow normal stack unwinding. finally blocks run during that unwinding, yet they do not magically swallow the exception unless code explicitly does so.
    interviewNotes: Interviewers may ask you to compare checked exceptions, runtime exceptions, and Error.
  - question: A service needs to run tasks asynchronously using a bounded thread pool instead of creating raw threads by hand. Which API is the best starting point?
    options:
      - ExecutorService
      - ObjectMapper
      - synchronized
      - ClassLoader
    correctIndex: 0
    answer: ExecutorService is the standard starting point for managing a pool of worker threads and submitted tasks.
    explanation: ExecutorService separates task submission from thread management and supports fixed pools, futures, graceful shutdown, and queueing. synchronized controls access to shared state, not task execution. The other choices are unrelated.
    interviewNotes: Good answers often mention shutdown(), Future, and the difference between CPU-bound and IO-bound workloads.
  - question: Which access level gives package-private visibility in Java?
    options:
      - public
      - protected
      - "(no modifier / default)"
      - private
    correctIndex: 2
    answer: Package-private visibility is the default when you do not write an access modifier.
    explanation: public is visible everywhere, private only inside the declaring class, and protected is visible to the package plus subclasses. The default visibility sits between private and protected for package-level API design.
    interviewNotes: A useful follow-up is why reducing visibility can make APIs safer and easier to evolve.
  - question: You are iterating over Map<String, Integer> counts and need both the key and the value in the loop. Which style is the clearest and most idiomatic?
    options:
      - Iterate only over values()
      - Use entrySet() iteration or forEach((k, v) -> ...)
      - Convert the map to two arrays first
      - Wrap the map in Stream.of(map)
    correctIndex: 1
    answer: entrySet() iteration or Map.forEach is the clearest way to access both keys and values together.
    explanation: entrySet() gives you direct access to both pieces of data in one pass. values() loses the key. Converting to arrays adds unnecessary work. Stream.of(map) does not flatten the map into entries.
    interviewNotes: This kind of question often checks whether you reach for the simplest readable collection view first.
  - question: You are building a CSV line inside a loop. Which class is the best default choice for repeated string concatenation in single-threaded code?
    options:
      - String
      - StringBuilder
      - StringBuffer
      - char[] for every case
    correctIndex: 1
    answer: StringBuilder is the best default choice for repeated concatenation in single-threaded code.
    explanation: StringBuilder is mutable, so it avoids creating many intermediate String objects. StringBuffer is synchronized and usually unnecessary unless multiple threads truly share the same builder. Raw char arrays are too low-level for most application code.
    interviewNotes: Interviewers may ask when StringBuffer is still relevant or how the compiler handles simple constant concatenation.
  - question: What is the safest assumption to make about finalize(), which is deprecated?
    options:
      - It runs exactly once before every garbage collection cycle
      - It may never run, so you should not rely on it for cleanup
      - It replaces try-with-resources for closing files
      - It runs synchronously on the application thread that created the object
    correctIndex: 1
    answer: You should assume finalize may never run and must not be relied on for resource cleanup.
    explanation: finalize is deprecated because it is unpredictable and harmful for correctness and performance. Use try-with-resources, explicit close methods, and well-defined ownership of resources instead.
    interviewNotes: A strong answer usually mentions AutoCloseable and try-with-resources immediately.
---

These questions are intentionally phrased like live interview prompts: short scenario, concrete trade-off, and one best answer you can defend out loud. Use them to warm up before a Java backend screen or to spot areas where your explanations are still too vague.

When you are ready for practice grounded in an actual job posting, generate a tailored set in PrepAhead instead of relying only on generic interview drills.
