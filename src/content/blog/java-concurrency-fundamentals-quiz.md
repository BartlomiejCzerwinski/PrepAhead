---
title: Java concurrency fundamentals quiz (10 questions)
description: Ten interview-style Java concurrency questions covering thread safety, executors, locks, atomics, and concurrent collections for mid-level backend engineers.
pubDate: 2026-06-05
type: interactive-quiz
tags:
  - Java
  - Concurrency
  - Backend
relatedSlugs:
  - java-mid-interview-quiz
  - java-memory-model-quiz
  - java-streams-and-collectors-quiz
quiz:
  - question: Two threads increment the same int field with count++. What is the most accurate default concern?
    options:
      - The JVM automatically batches the increments
      - count++ is atomic for int fields
      - A race condition can cause lost updates
      - The result is safe as long as the field is private
    correctIndex: 2
    answer: A race condition can cause lost updates because count++ is a read-modify-write sequence, not one atomic step.
    explanation: Each thread may read the same old value, increment it, and write back the same result. Privacy does not make shared mutation thread-safe. You need synchronization, an atomic type, or another coordination mechanism when multiple threads update shared state.
    example: |
      class Counter {
        int count = 0;
        void increment() {
          count++;
        }
      }
    interviewNotes: A common follow-up is when AtomicInteger is enough and when a lock is still needed for compound multi-field updates.
  - question: You need to run 500 short asynchronous tasks without manually creating 500 threads. Which API is the best starting point?
    options:
      - ExecutorService
      - ClassLoader
      - ThreadLocal
      - System.gc()
    correctIndex: 0
    answer: ExecutorService is the standard starting point because it separates task submission from thread management.
    explanation: Executors let you reuse a bounded pool, queue tasks, and shut down gracefully. Manually creating a thread per task is usually wasteful and harder to control. ThreadLocal solves per-thread state, not task scheduling.
    example: |
      ExecutorService pool = Executors.newFixedThreadPool(8);
      pool.submit(() -> processJob());
      pool.shutdown();
    interviewNotes: Strong answers often mention pool sizing trade-offs and the difference between CPU-bound and IO-bound workloads.
  - question: A method updates shared mutable state and must allow only one thread in the critical section at a time. Which keyword is the simplest default tool?
    options:
      - volatile
      - synchronized
      - transient
      - final
    correctIndex: 1
    answer: synchronized is the simplest default tool for mutual exclusion around a critical section.
    explanation: synchronized ensures one thread at a time enters the guarded block or method for the same monitor and also provides visibility guarantees on lock release and acquisition. volatile only addresses visibility for single reads and writes, not compound mutations.
    interviewNotes: Interviewers may ask you to compare synchronized with ReentrantLock and explain when explicit lock APIs are worth the extra complexity.
  - question: Which statement about Thread.sleep is correct in Java concurrency discussions?
    options:
      - It releases any synchronized monitor the thread currently holds
      - It guarantees another waiting thread runs next
      - It pauses the thread for at least the requested time without releasing held monitors
      - It makes code thread-safe by reducing contention
    correctIndex: 2
    answer: Thread.sleep pauses the current thread for at least the requested time and does not release monitors it already holds.
    explanation: Sleeping is only a timing mechanism and should not be treated as a coordination primitive. It does not guarantee scheduling order, and it does not fix races. If a sleeping thread holds a lock, other threads still cannot enter that synchronized region.
    interviewNotes: A useful follow-up is why sleep-based tests are flaky and why proper coordination primitives are preferred.
  - question: You need a thread-safe counter with frequent increments and reads but no broader multi-step invariant. Which choice is the best default?
    options:
      - AtomicInteger
      - ArrayList
      - StringBuilder
      - Optional<Integer>
    correctIndex: 0
    answer: AtomicInteger is the best default for a simple shared counter with atomic increments.
    explanation: AtomicInteger provides operations such as incrementAndGet without external locking for the single value. It is a good fit when the shared state is one atomic variable rather than a larger transaction across multiple objects.
    example: |
      AtomicInteger processed = new AtomicInteger();
      processed.incrementAndGet();
    interviewNotes: Good candidates mention that atomics work well for single-variable coordination but do not replace locks for complex invariants.
  - question: One thread produces work items and another consumes them in FIFO order. Which collection is the best fit?
    options:
      - BlockingQueue
      - HashSet
      - TreeMap
      - CopyOnWriteArrayList
    correctIndex: 0
    answer: BlockingQueue is the best fit for producer-consumer coordination with ordered handoff.
    explanation: A BlockingQueue provides thread-safe enqueue and dequeue operations and can block when the queue is empty or full depending on the implementation. That maps directly to producer-consumer workflows better than general-purpose collections.
    example: |
      BlockingQueue<String> queue = new LinkedBlockingQueue<>();
      queue.put("job-1");
      String next = queue.take();
    interviewNotes: Follow-ups often cover bounded versus unbounded queues and the backpressure implications of each.
  - question: You are iterating a collection while many threads read it and only rare writes happen. Which structure is often a good fit?
    options:
      - LinkedList
      - CopyOnWriteArrayList
      - PriorityQueue
      - HashMap
    correctIndex: 1
    answer: CopyOnWriteArrayList is often a good fit when reads dominate and writes are rare.
    explanation: It creates a fresh underlying array on each write, so readers can iterate without synchronization and without ConcurrentModificationException in typical cases. That makes reads cheap and predictable, but writes become expensive as the collection grows.
    interviewNotes: A strong answer mentions that copy-on-write is a niche optimization, not a general-purpose default for frequently updated collections.
  - question: You submit a Callable to an ExecutorService and need the result later. Which type usually represents that pending computation?
    options:
      - Future
      - Stream
      - Iterator
      - Comparator
    correctIndex: 0
    answer: Future represents the pending result of an asynchronous computation submitted to an executor.
    explanation: A Future lets you check completion, block for the result with get, and sometimes cancel the work. It is part of the basic executor model and often appears before interviewers move on to CompletableFuture.
    interviewNotes: Expect a follow-up on the limitations of Future, especially around composition and non-blocking orchestration.
  - question: A thread calls wait on an object monitor. Which condition must already be true?
    options:
      - The thread must hold that object's monitor
      - The object must be declared volatile
      - The thread must be in RUNNABLE state only
      - Another thread must already be sleeping
    correctIndex: 0
    answer: The thread must hold the object's monitor before calling wait.
    explanation: wait, notify, and notifyAll are monitor methods and must be used inside synchronized code for the same object. Otherwise Java throws IllegalMonitorStateException. When wait is called correctly, it releases the monitor and suspends until notification or interruption.
    interviewNotes: Interviewers often ask why wait should be used in a loop that rechecks the condition after wake-up.
  - question: Which statement about ConcurrentHashMap is most accurate?
    options:
      - It locks the entire map for every read
      - It is designed for concurrent access without fail-fast iteration on every write
      - It preserves insertion order like LinkedHashMap
      - It sorts keys like TreeMap
    correctIndex: 1
    answer: ConcurrentHashMap is designed for concurrent access and its iterators are weakly consistent rather than fail-fast on every write.
    explanation: The implementation prioritizes concurrency and scalable access over a perfectly fixed snapshot view. It does not preserve insertion order or sorted order. Reads are much less constrained than a single global lock design.
    interviewNotes: A common follow-up is when weakly consistent iteration is acceptable versus when you should snapshot data explicitly.
---

These questions focus on the concurrency concepts that come up often in mid-level Java interviews: what can go wrong with shared mutable state, which standard APIs solve which problems, and where the common footguns are.

If you want to go one level deeper after this set, pair it with memory model questions so you can explain not only which tool you would choose, but also why threads can or cannot observe each other's writes.
