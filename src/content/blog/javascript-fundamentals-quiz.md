---
title: JavaScript fundamentals quiz (10 questions)
description: Ten interview-style JavaScript fundamentals questions covering types, equality, arrays, objects, functions, and common runtime behavior for junior frontend engineers.
pubDate: 2026-06-06
type: interactive-quiz
tags:
  - JavaScript
  - Frontend
  - Fundamentals
relatedSlugs:
  - javascript-closures-and-scope-quiz
  - javascript-async-and-await-quiz
  - behavioral-system-design-prompts
quiz:
  - question: Which value is truthy in JavaScript?
    options:
      - "0"
      - ""
      - "[]"
      - "null"
    correctIndex: 2
    answer: An empty array is truthy in JavaScript.
    explanation: JavaScript treats all objects as truthy, and arrays are objects. By contrast, 0, the empty string, null, undefined, false, and NaN are falsy.
    interviewNotes: A common follow-up is why this matters in conditional rendering and form-validation code.
  - question: What is the result of typeof null?
    options:
      - "null"
      - "undefined"
      - "object"
      - "boolean"
    correctIndex: 2
    answer: typeof null returns "object".
    explanation: This is a long-standing historical quirk in JavaScript. It often comes up in interviews because it shows whether the candidate knows to avoid relying on typeof alone for null checks.
    interviewNotes: Strong answers mention using value === null when you need an exact null check.
  - question: You need to compare two values without type coercion. Which operator is the best default choice?
    options:
      - "=="
      - "==="
      - "="
      - "!="
    correctIndex: 1
    answer: === is the best default choice because it compares both value and type.
    explanation: The strict equality operator avoids JavaScript's coercion rules, which can make == comparisons surprising. In production code and interviews, === is usually the safer default.
    example: |
      5 === "5" // false
      5 == "5"  // true
    interviewNotes: Interviewers often ask for one or two surprising == examples to test whether you understand coercion.
  - question: Which method creates a new array without mutating the original one?
    options:
      - push()
      - pop()
      - splice()
      - map()
    correctIndex: 3
    answer: map creates a new array and leaves the original array unchanged.
    explanation: map transforms each element and returns a fresh array. push and pop mutate the original array, and splice also changes the array in place.
    interviewNotes: A useful follow-up is the difference between map, forEach, and filter.
  - question: What is the most accurate description of const in JavaScript?
    options:
      - It makes the value deeply immutable
      - It prevents reassignment of the binding
      - It makes the variable available only inside loops
      - It automatically freezes objects
    correctIndex: 1
    answer: const prevents reassignment of the variable binding.
    explanation: If a const variable points to an object or array, that object can still be mutated unless you explicitly freeze or clone it. const is about the binding, not deep immutability.
    interviewNotes: This question often leads into a discussion of reference values versus primitive values.
  - question: Which expression correctly checks whether an array contains the value 3?
    options:
      - arr.has(3)
      - arr.contains(3)
      - arr.includes(3)
      - arr.find(3)
    correctIndex: 2
    answer: arr.includes(3) is the correct built-in array membership check.
    explanation: includes returns a boolean indicating whether the value exists in the array. find is for retrieving a matching element by predicate, not for direct membership checks by value.
    example: |
      const ids = [1, 2, 3];
      ids.includes(3); // true
    interviewNotes: A common follow-up is the difference between includes and indexOf, especially around readability and NaN handling.
  - question: What does Object.keys(user) return?
    options:
      - An array of the object's own enumerable property names
      - A deep copy of the object
      - An iterator over values only
      - A Map of keys to values
    correctIndex: 0
    answer: Object.keys returns an array of the object's own enumerable property names.
    explanation: It is commonly used when you need to iterate over object properties, count them, or transform them. It returns names only, not values or entries.
    interviewNotes: Strong candidates often mention Object.values and Object.entries as related tools.
  - question: Which statement about functions in JavaScript is correct?
    options:
      - Functions are not first-class values
      - Functions can be passed as arguments and returned from other functions
      - Functions can only be declared with the function keyword
      - Functions always keep this bound to the caller automatically
    correctIndex: 1
    answer: Functions are first-class values and can be passed around like other values.
    explanation: This property is central to callbacks, array methods, event handlers, higher-order functions, and closures. It is one of the reasons JavaScript code often relies heavily on function composition.
    interviewNotes: A good follow-up is to ask the candidate for a simple higher-order function example from real UI or API code.
  - question: Which value does Array.isArray({}) return?
    options:
      - "true"
      - "false"
      - "object"
      - undefined
    correctIndex: 1
    answer: Array.isArray({}) returns false because a plain object is not an array.
    explanation: Array.isArray is the recommended built-in check for arrays because typeof returns "object" for both arrays and plain objects. That distinction comes up often in data-validation and rendering logic.
    interviewNotes: A common interview angle is why Array.isArray is safer than instanceof across realms.
  - question: You need to copy properties from one object into a new object without mutating the original. Which syntax is the clearest default?
    options:
      - delete source
      - "{ ...source }"
      - source.clone()
      - source.copy()
    correctIndex: 1
    answer: The object spread syntax creates a new object with the copied enumerable properties.
    explanation: Object spread is concise and readable for shallow copies. It does not create a deep copy, so nested objects are still shared by reference unless you clone them separately.
    example: |
      const updatedUser = { ...user, role: "admin" };
    interviewNotes: Interviewers often follow up by asking what "shallow copy" means and where shared nested references can still cause bugs.
---

These questions cover the JavaScript fundamentals that show up repeatedly in early frontend interviews: truthiness, equality, object and array basics, and the language behaviors that can trip people up in production code.

If this set feels easy on syntax but harder on reasoning, the next good step is closures and scope. That is where many interviewers start testing whether you understand how JavaScript really behaves at runtime.
