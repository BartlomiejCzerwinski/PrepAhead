---
title: Java memory model quiz (15 questions)
description: Fifteen senior-level Java memory model questions on visibility, happens-before, publication, reordering, volatile, and safe concurrent initialization.
pubDate: 2026-06-05
type: interactive-quiz
tags:
  - Java
  - JVM
  - Concurrency
  - Backend
relatedSlugs:
  - java-concurrency-fundamentals-quiz
  - java-mid-interview-quiz
  - java-streams-and-collectors-quiz
quiz:
  - question: One thread sets ready = true and another spins until ready becomes true. Without synchronization or volatile, what is the safest assumption?
    options:
      - The reader is guaranteed to observe the update immediately
      - The reader may never observe the update
      - int and boolean fields are always synchronized by the JVM
      - The compiler is forbidden from reordering these accesses
    correctIndex: 1
    answer: The safest assumption is that the reader may never observe the update in a timely way, or at all from the program's point of view.
    explanation: Without a happens-before relationship, the Java Memory Model does not guarantee visibility of one thread's write to another thread's read. CPU caches, compiler optimizations, and instruction reordering can all contribute to stale observations.
    interviewNotes: A classic follow-up is how declaring ready as volatile changes the guarantee.
  - question: What does a happens-before relationship primarily guarantee?
    options:
      - A thread gets exclusive ownership of all referenced objects
      - Earlier writes become visible to a later read that is ordered after them
      - Code runs on a single CPU core
      - Objects are promoted directly to the old generation
    correctIndex: 1
    answer: A happens-before relationship guarantees visibility and ordering for memory effects between the related actions.
    explanation: If action A happens-before action B, then the writes visible at A are guaranteed to be visible to B, subject to the normal rules of the memory model. This is why synchronization, volatile, thread start, thread join, and final-field rules matter.
    interviewNotes: Good answers mention that happens-before is broader than locking alone and includes several language-level ordering edges.
  - question: Which statement about volatile is correct?
    options:
      - It makes every operation on the variable atomic, including count++
      - It provides visibility and ordering guarantees for reads and writes of that variable
      - It is equivalent to synchronizing every method in the class
      - It prevents threads from ever seeing stale values in unrelated fields
    correctIndex: 1
    answer: volatile provides visibility and certain ordering guarantees for reads and writes of that variable.
    explanation: A volatile write is visible to later volatile reads of the same variable, and the memory model prevents some reorderings around those accesses. It does not make compound actions such as increment atomic, and it does not replace mutual exclusion for larger critical sections.
    interviewNotes: Interviewers often ask you to compare volatile with synchronized and atomic classes in one concrete scenario.
  - question: Why can instruction reordering be legal in correctly synchronized Java programs?
    options:
      - Because Java ignores the source code order entirely
      - Because the JVM may reorder operations as long as single-thread semantics and memory model guarantees are preserved
      - Because reordering is only allowed in native code
      - Because synchronized blocks disable all optimization
    correctIndex: 1
    answer: Reordering can be legal as long as the observable behavior remains valid under the Java Memory Model.
    explanation: Compilers and processors may change execution order for performance if the resulting program still respects the guarantees required by synchronization, volatile, final-field semantics, and as-if-serial behavior for a single thread. Unsafely shared state is where those optimizations become visible as bugs.
    interviewNotes: A strong answer separates source order, execution order, and visibility order instead of treating them as identical.
  - question: You publish an immutable configuration object through a properly constructed final field reference. Why is that attractive for concurrency?
    options:
      - final fields have special visibility guarantees after safe construction
      - final fields can be reassigned atomically by any thread
      - final disables garbage collection
      - final makes nested mutable objects automatically thread-safe
    correctIndex: 0
    answer: final fields have special visibility guarantees once the object is constructed safely and then published.
    explanation: The memory model gives stronger guarantees for final fields than for ordinary mutable fields, which is one reason immutable objects are so useful in concurrent code. However, the object still must not leak this during construction, and referenced mutable state can still be a problem.
    interviewNotes: Follow-ups often ask whether final on a reference also makes the referenced object immutable. It does not.
  - question: After threadA calls threadB.start, which statement is true?
    options:
      - threadB sees no writes from threadA before start
      - Actions in threadA before start happen-before actions in threadB after it begins
      - start is just a scheduling hint with no memory effect
      - threadB automatically joins threadA on completion
    correctIndex: 1
    answer: Actions in the parent thread before start happen-before actions in the started thread after it begins.
    explanation: Thread start creates an ordering edge in the Java Memory Model. That is why state prepared before calling start can be safely observed by the new thread without extra publication steps, assuming the object graph itself is not being mutated unsafely later.
    interviewNotes: The symmetric follow-up is usually about what join guarantees on the way back.
  - question: What does threadA.join on threadB give threadA after join returns successfully?
    options:
      - It guarantees threadB used only one CPU core
      - It guarantees threadA can see the effects of threadB's completed actions
      - It rolls back partial writes from threadB
      - It makes all objects touched by threadB immutable
    correctIndex: 1
    answer: join establishes that threadA can observe the memory effects of threadB's completed actions after the join returns.
    explanation: Thread completion and successful join form another happens-before edge. This is why join is not only a coordination tool for waiting, but also a visibility tool for results written before the worker thread finished.
    interviewNotes: A strong answer connects join to both liveness and visibility instead of treating it as mere blocking.
  - question: Which pattern is unsafe without volatile or synchronization in a lazily initialized singleton?
    options:
      - Eager static initialization
      - Enum singleton
      - Double-checked locking with a non-volatile instance field
      - Constructor injection
    correctIndex: 2
    answer: Double-checked locking is unsafe when the instance field is not volatile.
    explanation: Without volatile, another thread can observe a reference to a partially constructed object due to reordering between allocation, assignment, and initialization. Modern Java supports double-checked locking only when the shared instance reference is volatile.
    example: |
      class Holder {
        private static volatile Holder instance;
      }
    interviewNotes: This is a classic senior-level question. Interviewers usually want you to explain partial construction, not just recite the rule.
  - question: Why is publishing this from a constructor considered dangerous?
    options:
      - It disables escape analysis permanently
      - Other threads can observe the object before construction has finished
      - The object becomes automatically final
      - Constructors are always synchronized anyway
    correctIndex: 1
    answer: Publishing this from a constructor is dangerous because another thread may observe the object before initialization is complete.
    explanation: Escaping this during construction breaks the assumptions behind safe initialization and final-field semantics. Listeners, thread starts, and callbacks registered from constructors are common ways this bug appears in practice.
    interviewNotes: A good answer names at least one real escape path, such as starting a thread in the constructor or registering a listener.
  - question: Which statement about reading one volatile field and then an ordinary field written before that volatile write is most accurate?
    options:
      - The ordinary field is still guaranteed stale
      - The volatile read can make prior writes by the publishing thread visible
      - The ordinary field becomes immutable forever
      - Java forbids combining volatile and non-volatile fields in the same object
    correctIndex: 1
    answer: A volatile read can make earlier writes performed before the corresponding volatile write visible to the reading thread.
    explanation: This is why volatile often works as a publication flag. If a writer fully initializes state and then writes ready = true to a volatile field, a reader that sees ready as true is also guaranteed to observe the prior writes that happened before that volatile write.
    interviewNotes: The interview usually turns here toward publication patterns such as ready flags and immutable snapshots.
  - question: Which tool is the best default when multiple fields must change together under one invariant?
    options:
      - volatile on one representative field
      - synchronized or an explicit lock
      - Mark every field transient
      - Thread.sleep between writes
    correctIndex: 1
    answer: synchronized or an explicit lock is the best default when correctness depends on multiple fields changing together.
    explanation: Memory visibility alone is not enough if readers must never observe a half-updated state. Locks provide mutual exclusion plus ordering and visibility, which is what composite invariants usually require.
    interviewNotes: A common follow-up is to ask for an example where volatile is correct for a flag but wrong for a state machine.
  - question: If a reference to a mutable object is stored in a final field, what is true?
    options:
      - The referenced object becomes deeply immutable
      - The reference cannot change, but the object it points to may still mutate
      - The object can only be read by one thread
      - The field no longer needs safe publication
    correctIndex: 1
    answer: final fixes the reference, not the mutability of the object behind that reference.
    explanation: final helps with initialization safety for the reference itself, but deep immutability still depends on the object graph. If the referenced object exposes mutable state without synchronization, that state can still create race conditions.
    interviewNotes: Strong answers distinguish shallow immutability from deep immutability immediately.
  - question: Which publication approach is generally safe for sharing configuration snapshots across threads?
    options:
      - Store a mutable HashMap in a normal field and update it in place without synchronization
      - Publish a fully built immutable object through a volatile or final-backed safe path
      - Reuse one StringBuilder across threads
      - Use System.out.println after each write
    correctIndex: 1
    answer: Publishing a fully built immutable snapshot through a safe publication path is generally a strong approach.
    explanation: Immutable snapshots reduce coordination needs because readers do not modify the shared object. Pairing immutability with safe publication, such as static initialization, volatile publication, or lock-protected assignment, gives predictable visibility.
    interviewNotes: This is a great place to mention copy-on-write style designs or replacing whole objects instead of mutating them in place.
  - question: What is the most accurate reason a busy-spin loop on a non-volatile field is risky?
    options:
      - The field can move to disk
      - The JVM may hoist or cache the read so the loop never observes updates
      - The field turns into a synchronized block automatically
      - Java rewrites the loop into a sleep call
    correctIndex: 1
    answer: The loop is risky because the read may be optimized or cached in a way that prevents timely visibility of another thread's write.
    explanation: Without a memory barrier, the compiler or processor may treat the value as effectively unchanged from the looping thread's perspective. This is the same core visibility issue that makes plain flags unsafe for inter-thread signaling.
    interviewNotes: Interviewers may ask for safer alternatives such as volatile, locks, latches, or higher-level concurrency utilities.
  - question: Which statement about synchronized blocks and the memory model is correct?
    options:
      - They only serialize execution but do not affect visibility
      - Unlocking a monitor happens-before a later lock of the same monitor
      - They are slower because Java flushes the entire heap each time
      - They are only useful for I/O operations
    correctIndex: 1
    answer: Unlocking a monitor happens-before a later lock of the same monitor.
    explanation: That ordering rule is why synchronized protects both mutual exclusion and memory visibility. A thread entering the synchronized block after another thread exits the same monitor is guaranteed to observe the writes that were made inside the earlier critical section.
    interviewNotes: Good answers connect the rule back to a concrete bug class such as stale reads disappearing once access is consistently synchronized.
---

This set goes past API memorization and into the reasoning interviewers use to separate surface-level concurrency knowledge from real understanding. The key theme is not just which keyword to choose, but what visibility and ordering guarantee that choice creates.

If these questions still feel slippery, practice drawing the write-read relationships explicitly. Once you can explain the happens-before edge in plain language, most memory model interview questions become much easier to defend out loud.
