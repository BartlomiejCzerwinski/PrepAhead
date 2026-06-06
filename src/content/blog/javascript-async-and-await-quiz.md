---
title: JavaScript async and await quiz (10 questions)
description: Ten interview-style JavaScript async and await questions covering promises, error handling, sequencing, concurrency, and common frontend or full-stack pitfalls.
pubDate: 2026-06-06
type: interactive-quiz
tags:
  - JavaScript
  - Async
  - Full-stack
relatedSlugs:
  - javascript-fundamentals-quiz
  - javascript-closures-and-scope-quiz
  - behavioral-system-design-prompts
quiz:
  - question: What does an async function always return?
    options:
      - A plain object
      - A Promise
      - undefined unless it has a return statement
      - A callback function
    correctIndex: 1
    answer: An async function always returns a Promise.
    explanation: Even if the function appears to return a plain value, JavaScript wraps it in a resolved Promise. If it throws, the returned Promise is rejected instead.
    interviewNotes: A common follow-up is how this affects code that mixes async functions with older synchronous-looking APIs.
  - question: What does await do when used with a Promise inside an async function?
    options:
      - It blocks the entire JavaScript runtime thread
      - It pauses that async function until the Promise settles
      - It converts the Promise into a callback
      - It guarantees parallel execution of all later lines
    correctIndex: 1
    answer: await pauses the surrounding async function until the Promise settles.
    explanation: It does not freeze the whole runtime. Other work can continue while the async function is suspended, which is why await feels synchronous without actually blocking the event loop in the same way a long CPU task would.
    interviewNotes: Strong answers usually mention that await is syntax on top of Promise-based behavior, not a separate concurrency model.
  - question: Which pattern is best when two independent async requests can run at the same time and you need both results?
    options:
      - await requestA(); await requestB();
      - Promise.all([requestA(), requestB()])
      - setTimeout(() => requestA(), 0)
      - return requestA() + requestB()
    correctIndex: 1
    answer: Promise.all is the best default when independent async work can run concurrently and you need every result.
    explanation: Starting both Promises together avoids unnecessary sequential waiting. This is a common interview optimization point because many candidates accidentally serialize independent I/O with back-to-back awaits.
    example: |
      const [user, orders] = await Promise.all([
        fetchUser(),
        fetchOrders(),
      ]);
    interviewNotes: A useful follow-up is when Promise.all is the wrong choice because partial success is acceptable.
  - question: What happens if an awaited Promise rejects and you do not catch the error inside the async function?
    options:
      - The rejection is silently ignored
      - The async function returns a rejected Promise
      - The process always exits immediately
      - await retries automatically
    correctIndex: 1
    answer: The async function returns a rejected Promise if the awaited operation rejects and the error is not caught.
    explanation: Inside async functions, thrown errors and rejected awaited Promises both flow through Promise rejection. That is why try/catch works naturally with await.
    interviewNotes: Interviewers often ask you to compare error handling in async/await versus raw Promise chains.
  - question: Which try/catch example correctly handles an awaited failure?
    options:
      - try { await loadUser(); } catch (error) { handle(error); }
      - try { loadUser(); } catch (error) { handle(error); }
      - catch (error) { await loadUser(); }
      - await try loadUser() catch handle(error)
    correctIndex: 0
    answer: Wrapping the awaited call in try/catch is the correct async/await error-handling pattern.
    explanation: Once you use await inside the try block, rejections are surfaced as exceptions that can be caught in the matching catch block. Calling an async function without await does not let that surrounding try/catch catch the eventual rejection.
    interviewNotes: A strong follow-up is to explain when you would intentionally return the Promise upward instead of catching locally.
  - question: Why is using await inside a for loop sometimes a performance problem?
    options:
      - await is forbidden inside loops
      - It forces each iteration to wait for the previous one, which can serialize otherwise independent work
      - for loops are always slower than map
      - JavaScript disables promises inside loops
    correctIndex: 1
    answer: await inside a loop can serialize independent async operations and make the code slower than necessary.
    explanation: Sometimes sequential behavior is correct, but when each iteration is independent, collecting Promises first and then awaiting them together is often faster. Interviews often use this to test whether you can reason about concurrency versus sequence.
    interviewNotes: A good answer mentions that correctness comes first, and some workflows do need strict sequential ordering.
  - question: What is the main difference between Promise.all and Promise.allSettled?
    options:
      - Promise.allSettled runs synchronously
      - Promise.all rejects early on the first failure, while Promise.allSettled waits for every Promise and reports each outcome
      - Promise.all can only handle two Promises
      - Promise.allSettled automatically retries failures
    correctIndex: 1
    answer: Promise.all fails fast on the first rejection, while Promise.allSettled waits for all inputs and returns their individual statuses.
    explanation: This matters when your product can tolerate partial failure, such as loading several dashboard widgets independently. It is also a common interview question because it reveals whether the candidate chooses concurrency primitives based on business behavior.
    interviewNotes: Strong answers include one realistic use case for each API rather than describing them only abstractly.
  - question: What is wrong with using Array.forEach(async item => { await save(item); }) when you expect the outer function to wait for all saves?
    options:
      - forEach cannot iterate arrays with objects
      - forEach does not await the async callbacks, so the outer flow can continue before the work finishes
      - save must be a synchronous function
      - async callbacks only work with map
    correctIndex: 1
    answer: forEach does not await async callbacks, so it is a common source of unfinished work and confusing control flow.
    explanation: If you need to wait for all operations, use a loop with await for sequence or map the items to Promises and use Promise.all for concurrency. This is one of the most common practical async interview traps.
    example: |
      await Promise.all(items.map((item) => save(item)));
    interviewNotes: A follow-up often asks the candidate to rewrite the snippet correctly for both sequential and concurrent requirements.
  - question: Which statement about top-level await is most accurate?
    options:
      - It is available everywhere in every script automatically
      - It can be used in module contexts that support it, not in every JavaScript file universally
      - It makes all imports synchronous
      - It replaces Promise-based APIs entirely
    correctIndex: 1
    answer: Top-level await is available only in supported module contexts, not universally in every JavaScript script.
    explanation: Environment and module system details matter here, which is why interviews may use this question to test whether you understand the runtime context instead of memorizing syntax in isolation.
    interviewNotes: Good answers stay careful about environment differences rather than over-claiming broad support rules.
  - question: You need one request to happen only after another finishes because the second depends on the first result. What is the clearest approach?
    options:
      - Start both and ignore ordering
      - Use sequential await with the second request based on the first result
      - Use Promise.all to force the dependency
      - Use setInterval instead of await
    correctIndex: 1
    answer: Sequential await is the clearest approach when the second operation depends on the first result.
    explanation: Not all async work should be parallelized. In interviews, a strong answer shows that you can distinguish true dependencies from accidentally serialized independent work.
    example: |
      const user = await fetchUser();
      const profile = await fetchProfile(user.id);
    interviewNotes: A useful follow-up is to ask the candidate to identify which lines in a mixed workflow can run concurrently and which cannot.
---

This set focuses on the async patterns interviewers care about most in JavaScript: what `async` and `await` really return, how errors flow, and when code is accidentally sequential or accidentally unfinished.

Once these questions feel natural, the next useful step is the event loop. That is usually where interviewers go when they want you to explain why asynchronous code behaves in a surprising order.
