---
title: Java collections interview quiz (5 questions)
description: Five interview-style Java collections questions on lists, maps, sets, and concurrent access, with concise explanations and follow-up notes.
pubDate: 2026-05-30
type: interactive-quiz
tags:
  - Java
  - Collections
  - Backend
relatedSlugs:
  - java-mid-interview-quiz
  - behavioral-system-design-prompts
quiz:
  - question: You are reviewing backend code that stores ordered results and frequently calls get(i). Which List implementation is the best default choice?
    options:
      - LinkedList
      - ArrayList
      - CopyOnWriteArrayList
      - Vector
    correctIndex: 1
    answer: ArrayList is the best default choice when you need fast random access by index.
    explanation: ArrayList stores elements in a resizable array, so indexed reads are O(1). LinkedList must walk nodes for get(i), which is O(n). CopyOnWriteArrayList is specialized for many reads and very few writes. Vector is legacy and synchronized by default.
    example: |
      List<String> candidates = new ArrayList<>();
      candidates.add("alice");
      String first = candidates.get(0);
    interviewNotes: A common follow-up is when LinkedList is actually useful. Mention queue-like workloads or frequent inserts/removes at known ends, not random access.
  - question: Your API response must always return customer names sorted alphabetically by key. Which Map implementation fits that requirement best?
    options:
      - HashMap
      - LinkedHashMap
      - TreeMap
      - ConcurrentHashMap
    correctIndex: 2
    answer: TreeMap is the right choice when keys must stay sorted.
    explanation: TreeMap keeps keys ordered by natural ordering or a provided Comparator. HashMap gives no iteration-order guarantee. LinkedHashMap preserves insertion or access order, not sorted order. ConcurrentHashMap is for thread-safe access, not sorted iteration.
    example: |
      Map<String, Integer> scores = new TreeMap<>();
      scores.put("zoe", 7);
      scores.put("anna", 9);
      // Iteration order: anna, zoe
    interviewNotes: Interviewers often ask you to compare TreeMap O(log n) operations with HashMap average O(1) access.
  - question: A service needs to deduplicate user IDs and answer contains(id) checks quickly. Which collection is the best default fit?
    options:
      - ArrayList
      - HashSet
      - LinkedList
      - TreeSet
    correctIndex: 1
    answer: HashSet is the best default choice for deduplication plus fast membership checks.
    explanation: HashSet is designed for near-constant-time add, remove, and contains when hash codes are well distributed. ArrayList and LinkedList require linear scans for contains. TreeSet keeps elements sorted, which adds ordering cost you do not need here.
    interviewNotes: Be ready to explain the equals/hashCode contract and why mutable keys are dangerous in hash-based collections.
  - question: You want predictable iteration order that matches insertion order for a Map, but you do not need the keys sorted. Which implementation should you pick?
    options:
      - HashMap
      - LinkedHashMap
      - TreeMap
      - Hashtable
    correctIndex: 1
    answer: LinkedHashMap preserves insertion order while keeping the Map API.
    explanation: LinkedHashMap adds ordering on top of hash-based lookup. HashMap does not guarantee iteration order. TreeMap sorts by key rather than preserving insertion order. Hashtable is legacy and not the modern default choice.
    interviewNotes: A strong answer also mentions that LinkedHashMap can be configured for access-order iteration, which is useful in simple LRU-style caches.
  - question: During an interview, you are asked what happens if one thread updates a ConcurrentHashMap while another thread is iterating it. Which answer is most accurate?
    options:
      - The iterator immediately throws ConcurrentModificationException
      - The iterator is weakly consistent and may reflect some concurrent updates
      - The map blocks all readers until iteration finishes
      - Every read works from a full snapshot copy
    correctIndex: 1
    answer: ConcurrentHashMap iterators are weakly consistent and may reflect some, all, or none of the concurrent updates.
    explanation: Unlike fail-fast iterators on many non-concurrent collections, ConcurrentHashMap does not throw ConcurrentModificationException on every concurrent write. It also does not take a full snapshot for each read. The design favors concurrency over a perfectly fixed iteration view.
    interviewNotes: A useful follow-up is when you would still prefer explicit locking or a snapshot copy for deterministic reads.
---

These questions are written in the style many interviewers use: a small scenario, a concrete trade-off, and one best default choice. Work through them before an interview loop or use them as a warm-up before timed practice.

Once you want questions tied to a real job description instead of general Java prep, use PrepAhead to generate a role-specific set in the app.
