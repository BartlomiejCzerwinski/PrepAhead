---
title: JavaScript closures and scope quiz (10 questions)
description: Ten interview-style JavaScript questions on lexical scope, closures, hoisting, block scope, and common callback pitfalls for mid-level frontend engineers.
pubDate: 2026-06-06
type: interactive-quiz
tags:
  - JavaScript
  - Closures
  - Frontend
relatedSlugs:
  - javascript-fundamentals-quiz
  - javascript-async-and-await-quiz
  - behavioral-system-design-prompts
quiz:
  - question: What is a closure in JavaScript?
    options:
      - A syntax error caused by nested functions
      - A function bundled with access to variables from its lexical outer scope
      - A special kind of Promise
      - A function that can only run once
    correctIndex: 1
    answer: A closure is a function that keeps access to variables from its lexical outer scope even after that outer function has returned.
    explanation: Closures are a normal part of how JavaScript functions work. They power callbacks, factory functions, memoization, and many module-like patterns.
    interviewNotes: Strong answers use a short real example, such as a function returning another function that increments a private counter.
  - question: In JavaScript, what does lexical scope mean?
    options:
      - Variable access depends on where the function is called from
      - Variable access depends on where the function is defined in the source code
      - Variables are always global unless declared with var
      - Scope is determined only at runtime by the event loop
    correctIndex: 1
    answer: Lexical scope means variable access is determined by where a function is defined, not where it is called.
    explanation: JavaScript resolves identifiers by looking outward through the scope chain created by the source structure. This is why moving a function definition can change what variables it can see.
    interviewNotes: A common follow-up is to compare lexical scope with dynamic scope and explain that JavaScript uses lexical scope.
  - question: Which declaration is block-scoped?
    options:
      - var
      - let
      - function in every case
      - window.property
    correctIndex: 1
    answer: let is block-scoped.
    explanation: Variables declared with let and const exist only inside the nearest block. var is function-scoped, which is why it behaves differently inside loops and conditionals.
    example: |
      if (true) {
        let count = 1;
      }
      // count is not defined here
    interviewNotes: Interviewers often ask you to compare let and var inside a for loop with asynchronous callbacks.
  - question: Why does this classic loop produce repeated values with var and setTimeout?
    options:
      - setTimeout clones the function body incorrectly
      - var creates one shared function-scoped binding that each callback closes over
      - setTimeout runs synchronously
      - JavaScript arrays reorder loop variables automatically
    correctIndex: 1
    answer: With var, each callback closes over the same function-scoped binding, so they all read the final loop value later.
    explanation: The issue is not the timer itself but the shared binding created by var. Using let in the loop creates a fresh block-scoped binding for each iteration.
    example: |
      for (var i = 0; i < 3; i++) {
        setTimeout(() => console.log(i), 0);
      }
      // logs 3, 3, 3
    interviewNotes: A strong follow-up answer explains both the let fix and the IIFE fix for older code.
  - question: What is hoisting best described as?
    options:
      - JavaScript moving lines in your source file
      - The language's creation of bindings before execution, with different initialization behavior by declaration type
      - A browser-only optimization for script tags
      - A rule that all values become global first
    correctIndex: 1
    answer: Hoisting is the creation of bindings before execution, with different behavior depending on whether you used var, let, const, or function declarations.
    explanation: Function declarations are available earlier in their scope, var is hoisted and initialized to undefined, and let or const exist in the temporal dead zone until their declaration is evaluated. Interviews usually care about this behavior, not the metaphor alone.
    interviewNotes: Good answers mention that hoisting does not mean let and const are safely usable before their declaration line.
  - question: What happens if you read a let variable before its declaration in the same scope?
    options:
      - It returns undefined
      - It returns null
      - It throws a ReferenceError
      - It silently creates a global variable
    correctIndex: 2
    answer: Reading a let variable before its declaration throws a ReferenceError.
    explanation: That behavior comes from the temporal dead zone, the period between entering the scope and executing the declaration. const behaves the same way with respect to early access.
    interviewNotes: This question often checks whether the candidate incorrectly generalizes var behavior to let and const.
  - question: Which pattern is a practical use of closures?
    options:
      - Hiding private state inside a factory function
      - Converting every array into a Set
      - Forcing synchronous network requests
      - Disabling garbage collection
    correctIndex: 0
    answer: Closures are often used to hide private state inside a factory function.
    explanation: A returned function can still access variables from the outer function even after that outer function finishes. This is a simple way to encapsulate state without exposing it directly on an object.
    example: |
      function createCounter() {
        let count = 0;
        return () => ++count;
      }
    interviewNotes: A useful follow-up is when a class or module would be clearer than closure-based private state.
  - question: Inside a nested function, JavaScript looks up a missing variable name by searching where first?
    options:
      - The global scope only
      - The call stack of the most recent function invocation only
      - The current scope, then outer lexical scopes outward
      - The DOM tree
    correctIndex: 2
    answer: JavaScript looks in the current scope first, then walks outward through outer lexical scopes.
    explanation: This chain of nested scopes is what allows inner functions to use variables defined outside them. If the name is not found anywhere in the scope chain, a ReferenceError occurs when the code runs.
    interviewNotes: Strong answers distinguish the lexical scope chain from object prototype lookup, which is a different mechanism.
  - question: Which statement about closures and memory is most accurate?
    options:
      - Closures always cause memory leaks
      - Closures can keep referenced outer variables alive as long as the inner function remains reachable
      - Closures prevent garbage collection entirely
      - Closures are optimized away in every browser
    correctIndex: 1
    answer: Closures can keep referenced outer variables alive while the closure is still reachable.
    explanation: This is not a problem by itself, but it matters when long-lived callbacks retain large objects or DOM references unnecessarily. Interviews sometimes use this question to bridge into performance or leak debugging.
    interviewNotes: A good follow-up is to describe one real case, such as an event handler retaining stale component data.
  - question: Why is let usually preferred over var in modern interview answers?
    options:
      - let is faster by language guarantee
      - let avoids accidental function-scoped sharing and is easier to reason about
      - let makes values immutable
      - let is required for arrow functions
    correctIndex: 1
    answer: let is usually preferred because block scope matches developer expectations better and avoids many var-related footguns.
    explanation: let reduces bugs caused by unintended sharing across loops and blocks, especially with asynchronous callbacks. It also makes code easier to explain during interviews because the scoping model is more predictable.
    interviewNotes: A strong answer mentions const as the default for bindings that should not be reassigned, with let reserved for actual rebinding.
---

Closures and scope are where JavaScript interviews start shifting from surface syntax to runtime reasoning. The candidate usually is not being tested on vocabulary alone, but on whether they can predict what code actually sees and when.

If this set exposed weak spots, pair it with async questions next. A lot of real interview bugs happen when closures, timers, and promises all interact in the same snippet.
