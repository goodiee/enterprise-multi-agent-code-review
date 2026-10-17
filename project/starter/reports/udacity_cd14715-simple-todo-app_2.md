# Code Review Report

**Repository:** udacity/cd14715-simple-todo-app
**Pull Request:** #2

## Summary

| Metric | Value |
|---|---:|
| Overall Score | 25/100 |
| Files Reviewed | 1 |
| Critical Issues | 3 |
| High Priority Tests | 8 |
| Refactoring Opportunities | 7 |

## Top Recommendations

1. **[CRITICAL] Security - SQL Injection**

IMMEDIATE ACTION REQUIRED: Fix all three SQL injection vulnerabilities before merging. The searchTodos, searchTodosByStatus, and getTodosByUser functions use string concatenation and template literals to build SQL queries with unsanitized user input. This allows attackers to execute arbitrary SQL commands, potentially leading to complete database compromise, data theft, unauthorized access, data manipulation, or denial of service. Replace all string concatenation with parameterized queries using placeholder syntax ($1, $2, etc.) and pass user input as separate parameters to db.query().

   **Files:** src/todo.ts

2. **[CRITICAL] Security - Authorization**

Add authorization checks to getTodosByUser function. Currently, any user can request any other user's todos without permission verification. Implement access control to ensure users can only access their own todos unless they have admin privileges. Add parameters for requestingUserId and isAdmin, and validate that userId === requestingUserId || isAdmin before executing the query.

   **Files:** src/todo.ts

3. **[CRITICAL] Testing - Security Test Coverage**

Add comprehensive security-focused test suite for all three new functions. Currently there are ZERO tests for the new code. Tests must verify: (1) SQL injection attacks are prevented with malicious inputs like "'; DROP TABLE todos; --", (2) Input validation rejects empty/null/invalid inputs, (3) Special characters and SQL wildcards are properly escaped, (4) Authorization checks prevent unauthorized access in getTodosByUser, (5) Error handling works correctly, (6) Normal functionality works with valid inputs. Security vulnerabilities cannot be verified as fixed without tests.

   **Files:** src/todo.ts

4. **[HIGH] Security - Input Validation**

Implement comprehensive input validation for all new functions. Add validation for: (1) null/undefined checks, (2) type validation (searchTodosByStatus should accept boolean, not string), (3) length limits on search keywords (max 100 chars), (4) format validation for userId (UUID/integer format), (5) sanitization of special SQL characters. Input validation is a critical defense-in-depth measure even when using parameterized queries.

   **Files:** src/todo.ts

5. **[HIGH] Reliability - Error Handling**

Add proper error handling to all three new functions. Wrap database operations in try-catch blocks to handle connection failures, query errors, and timeouts. Log errors securely without exposing sensitive information. Return user-friendly error messages and appropriate HTTP status codes. Unhandled errors can expose sensitive information in stack traces or cause application crashes.

   **Files:** src/todo.ts

6. **[HIGH] Performance - Pagination**

Implement pagination for all search functions to prevent performance issues and memory exhaustion. Add LIMIT clauses to restrict result set size (e.g., LIMIT 100). Implement pagination parameters (page number, page size) and return pagination metadata. The LIKE queries with wildcards on both sides (%keyword%) are particularly expensive and could cause severe performance degradation on large datasets. Consider adding database indexes on title and description columns.

   **Files:** src/todo.ts

7. **[MEDIUM] Code Quality - Maintainability**

Refactor to reduce code duplication across the three search functions. Extract common patterns (validation, query execution, error handling) into reusable utilities or implement the Strategy pattern with QueryExecutor classes. This centralization improves maintainability and ensures security controls are consistently applied. Consider adopting a query builder library like Knex.js or an ORM like Prisma/TypeORM to further reduce boilerplate and improve type safety.

   **Files:** src/todo.ts

8. **[MEDIUM] Code Quality - Documentation**

Add comprehensive JSDoc documentation for all three new functions. Include @param tags with types and descriptions, @returns tags with return types, @throws tags for error conditions, and usage examples. Document authorization requirements for getTodosByUser and security considerations. While functions have warning comments about vulnerabilities, they lack proper documentation for intended usage after fixes are applied.

   **Files:** src/todo.ts

9. **[LOW] Security - Audit Logging**

Implement audit logging for all search operations. Log timestamp, user identity, search parameters, result counts, and execution time. Store logs in secure, tamper-proof storage for security analysis, compliance, and incident investigation. Audit logs are essential for detecting suspicious activity, investigating security incidents, and meeting compliance requirements.

   **Files:** src/todo.ts

10. **[LOW] Security - Rate Limiting**

Add rate limiting for search operations to prevent abuse and denial-of-service attacks. Implement per-user or per-IP rate limits using libraries like express-rate-limit. Search queries, especially LIKE queries, are resource-intensive and can be exploited to cause performance degradation or service outages if not rate limited.

   **Files:** src/todo.ts


## Detailed File Reviews

### src/todo.ts

**Quality Score:** 25/100

**Estimated Test Coverage:** 0%

**Tests Present:** No

#### Code Quality

CRITICAL SECURITY VULNERABILITIES DETECTED: All three new functions (searchTodos, searchTodosByStatus, getTodosByUser) contain SQL injection vulnerabilities due to string concatenation and template literal interpolation in SQL queries. This is a severe security risk that could lead to data breaches, unauthorized access, and complete database compromise. The vulnerabilities are clearly marked with warning comments in the code but have not been fixed. Additionally, the code lacks input validation, error handling, pagination, and comprehensive documentation. The overall code quality score of 25/100 reflects the presence of multiple critical security vulnerabilities that must be addressed immediately before any deployment. This PR should NOT be merged in its current state.

**[CRITICAL] security — Line 119**

SQL injection vulnerability in searchTodos function. The function uses template literal string interpolation to embed user input directly into SQL query: `SELECT * FROM todos WHERE title LIKE '%${keyword}%' OR description LIKE '%${keyword}%'`. This allows attackers to inject malicious SQL code.

**Suggestion:** Use parameterized queries with placeholder syntax. Replace with: const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2'; const searchPattern = `%${keyword}%`; await db.query(query, [searchPattern, searchPattern]);

**[CRITICAL] security — Line 128**

SQL injection vulnerability in searchTodosByStatus function. User input is directly concatenated into SQL query using string concatenation: "SELECT * FROM todos WHERE completed = " + completed. An attacker can inject arbitrary SQL commands.

**Suggestion:** Implement parameterized queries. Replace with: const query = 'SELECT * FROM todos WHERE completed = $1'; await db.query(query, [completed]); Also add boolean type validation for the completed parameter.

**[CRITICAL] security — Line 138**

SQL injection vulnerability in getTodosByUser function. Template literal directly embeds userId into JOIN query without parameterization: WHERE ut.user_id = '${userId}'. This enables SQL injection attacks and potential unauthorized data access.

**Suggestion:** Use parameterized query: const query = 'SELECT t.* FROM todos t JOIN user_todos ut ON t.id = ut.todo_id WHERE ut.user_id = $1'; await db.query(query, [userId]);

**[HIGH] security — Line 119**

Missing input validation in searchTodos function. No validation of keyword parameter for null/undefined, type checking, length limits, or sanitization before database operations.

**Suggestion:** Add comprehensive input validation: if (!keyword || typeof keyword !== 'string') throw new Error('Invalid keyword'); if (keyword.length > 100) throw new Error('Search term too long'); const sanitizedKeyword = keyword.trim();

**[HIGH] security — Line 128**

Missing input validation and type safety in searchTodosByStatus function. The parameter should be a boolean but is typed as string, and no validation ensures it contains safe values.

**Suggestion:** Change parameter type to boolean and add validation: export async function searchTodosByStatus(completed: boolean): Promise<Todo[]>. Add runtime type checking if receiving from untrusted sources.

**[HIGH] security — Line 138**

Missing input validation and authorization checks in getTodosByUser function. No validation of userId format, and no verification that the requesting user is authorized to access another user's todos.

**Suggestion:** Add input validation and authorization: if (!userId || typeof userId !== 'string') throw new Error('Invalid userId'); // Add authorization check: if (requestingUserId !== userId && !isAdmin(requestingUserId)) throw new Error('Unauthorized');

**[MEDIUM] bug-risk — Line 119**

Missing error handling in searchTodos function. Database errors from malformed queries or connection issues are not caught, which could expose sensitive error details or cause application crashes.

**Suggestion:** Wrap in try-catch block: try { /* query logic */ } catch (error) { logger.error('Search todos failed', { keyword, error }); throw new DatabaseError('Failed to search todos'); }

**[MEDIUM] bug-risk — Line 128**

Missing error handling in searchTodosByStatus function. Unhandled promise rejections could occur from database errors.

**Suggestion:** Add try-catch error handling with proper logging and user-friendly error messages. Consider returning empty array on certain error types vs throwing.

**[MEDIUM] bug-risk — Line 138**

Missing error handling in getTodosByUser function. JOIN query failures are not handled, and failed queries could expose database structure in error messages.

**Suggestion:** Implement comprehensive error handling with try-catch. Handle specific cases like user not found separately from database errors. Return appropriate HTTP status codes.

**[MEDIUM] performance — Line 119**

Missing pagination in searchTodos function. LIKE queries with wildcards on both sides (%keyword%) are inefficient and can cause performance issues on large datasets. No LIMIT clause prevents unbounded result sets.

**Suggestion:** Add pagination parameters and implement LIMIT/OFFSET: function searchTodos(keyword: string, page = 1, pageSize = 20). Add query: SELECT * FROM todos WHERE ... LIMIT $3 OFFSET $4. Consider adding database indexes on title and description columns.

**[MEDIUM] performance — Line 128**

Missing result limiting in searchTodosByStatus function. Could return massive result sets causing memory and performance issues.

**Suggestion:** Add pagination with LIMIT and OFFSET. Implement page size limits (e.g., max 100 items per request). Return pagination metadata in response.

**[MEDIUM] performance — Line 138**

Missing pagination in getTodosByUser function. Users with thousands of todos would cause slow queries and high memory usage. No optimization of the JOIN operation.

**Suggestion:** Implement cursor-based or offset-based pagination. Add LIMIT clause. Consider adding composite index on (user_id, todo_id) for the join. Add query hints if supported by database.

**[LOW] maintainability — Line 119**

Code duplication across search functions. Similar query patterns repeated across searchTodos, searchTodosByStatus, and getTodosByUser without abstraction.

**Suggestion:** Extract common query execution logic into a reusable queryBuilder utility or adopt an ORM like TypeORM or Prisma to reduce boilerplate and improve maintainability.

**[LOW] best-practice — Line 119**

Incomplete JSDoc documentation for searchTodos. While function has a warning comment, it lacks proper JSDoc with @param, @returns, @throws tags.

**Suggestion:** Add complete JSDoc: /** * Searches todos by keyword in title and description * @param {string} keyword - Search term * @returns {Promise<Todo[]>} Matching todos * @throws {DatabaseError} On query failure */

**[LOW] best-practice — Line 128**

Missing proper documentation for searchTodosByStatus function. No JSDoc describing parameters, return values, or expected behavior.

**Suggestion:** Add JSDoc documentation describing the function purpose, parameter expectations (should be boolean), return type, and error conditions.

**[LOW] best-practice — Line 138**

Missing documentation for getTodosByUser function. No description of the JOIN operation or authorization requirements.

**Suggestion:** Add comprehensive JSDoc including description of the user_todos relationship, authorization requirements, and pagination recommendations.

**[INFO] best-practice — Line 119**

No rate limiting for search operations. Expensive search queries could be abused for denial-of-service attacks.

**Suggestion:** Implement rate limiting middleware to restrict search requests per user/IP. Use libraries like express-rate-limit with sliding window counters.

**[INFO] security — Line 119**

Missing audit logging for search operations. Security incidents, data access patterns, and suspicious queries cannot be tracked or investigated.

**Suggestion:** Implement structured audit logging for all search operations including timestamp, user identity, search parameters, result counts, and execution time. Store in secure, tamper-proof log storage.

#### Test Coverage

ZERO TEST COVERAGE for all three new functions added in this PR. The three new search functions (searchTodos, searchTodosByStatus, getTodosByUser) have NO tests despite containing critical SQL injection vulnerabilities. This is completely unacceptable for security-critical code. All three functions require comprehensive test suites covering: (1) SQL injection prevention, (2) input validation, (3) edge cases (empty inputs, special characters, invalid types), (4) error handling, (5) authorization checks for getTodosByUser, and (6) performance/pagination. The lack of tests means these vulnerabilities cannot be verified as fixed and the functions cannot be safely deployed. Estimated current coverage: 0%. Required coverage before merge: 100% of new code with security-focused test cases.

**Related test files:** None identified

**[CRITICAL] function: searchTodos (line 119)**

**Reason:** New function added in this PR with critical SQL injection vulnerability. Tests are essential to verify parameterized query implementation and validate that SQL injection attacks are prevented. Without tests, the security fix cannot be verified.

**Suggested test:** Test SQL injection prevention: test('should prevent SQL injection in searchTodos', async () => { const maliciousInput = "'; DROP TABLE todos; --"; await expect(searchTodos(maliciousInput)).resolves.not.toThrow(); // Verify todos table still exists }). Test normal search: test('should return todos matching keyword', async () => { await createTodo({title: 'Buy milk', description: 'Get 2%'}); const results = await searchTodos('milk'); expect(results).toHaveLength(1); expect(results[0].title).toBe('Buy milk'); }).

**[CRITICAL] function: searchTodosByStatus (line 128)**

**Reason:** New function with SQL injection vulnerability and incorrect parameter type (string instead of boolean). Tests must verify both security and correct type handling. The concatenation vulnerability makes this extremely dangerous.

**Suggested test:** Test SQL injection prevention: test('should prevent SQL injection in searchTodosByStatus', async () => { const maliciousInput = "1 OR 1=1; DROP TABLE todos; --"; await expect(searchTodosByStatus(maliciousInput)).resolves.not.toThrow(); }). Test boolean parameter: test('should filter by completion status', async () => { await createTodo({title: 'Task 1', completed: true}); await createTodo({title: 'Task 2', completed: false}); const completed = await searchTodosByStatus(true); expect(completed.every(t => t.completed)).toBe(true); }).

**[CRITICAL] function: getTodosByUser (line 138)**

**Reason:** New function with SQL injection vulnerability in JOIN query. Without tests, the security vulnerability and authorization logic cannot be verified. JOIN queries are complex and error-prone, requiring comprehensive testing.

**Suggested test:** Test SQL injection prevention: test('should prevent SQL injection in getTodosByUser', async () => { const maliciousUserId = "' OR '1'='1"; await expect(getTodosByUser(maliciousUserId)).resolves.not.toThrow(); }). Test authorization: test('should only return todos for specified user', async () => { const user1Todos = await getTodosByUser('user1'); expect(user1Todos.every(t => t.userId === 'user1')).toBe(true); }). Test JOIN correctness: test('should correctly join todos and user_todos tables', async () => { // Verify JOIN returns correct data structure }).

**[HIGH] edge-case: searchTodos with empty/null keyword (line 119)**

**Reason:** Edge case handling for empty, null, or whitespace-only search terms is not implemented. This could cause database errors or return all records unintentionally.

**Suggested test:** test('should handle empty keyword gracefully', async () => { await expect(searchTodos('')).resolves.toEqual([]); await expect(searchTodos('   ')).resolves.toEqual([]); await expect(searchTodos(null)).rejects.toThrow('Invalid keyword'); });

**[HIGH] edge-case: searchTodos with special characters (line 119)**

**Reason:** Special SQL characters (%,_, [, ], etc.) in search terms could cause unexpected LIKE query behavior or be exploited for SQL injection. LIKE wildcards must be escaped.

**Suggested test:** test('should escape SQL wildcards in search term', async () => { await createTodo({title: '100% complete', description: 'test'}); const results = await searchTodos('100%'); expect(results[0].title).toBe('100% complete'); // Should match literally, not as wildcard });

**[HIGH] edge-case: searchTodosByStatus with invalid types (line 128)**

**Reason:** Function accepts string but should accept boolean. Edge cases include non-boolean strings, null, undefined, and type coercion issues. Without validation, invalid inputs could cause database errors.

**Suggested test:** test('should validate status parameter type', async () => { await expect(searchTodosByStatus('invalid')).rejects.toThrow(); await expect(searchTodosByStatus(null)).rejects.toThrow(); await expect(searchTodosByStatus(undefined)).rejects.toThrow(); });

**[HIGH] edge-case: getTodosByUser with non-existent user (line 138)**

**Reason:** No handling for users that don't exist in the database. Should return empty array rather than error. JOIN may behave unexpectedly with invalid user IDs.

**Suggested test:** test('should return empty array for non-existent user', async () => { const result = await getTodosByUser('nonexistent-user-id'); expect(result).toEqual([]); });

**[CRITICAL] edge-case: getTodosByUser authorization (line 138)**

**Reason:** No authorization checks to prevent users from accessing other users' todos. This is a critical security vulnerability allowing unauthorized data access.

**Suggested test:** test('should enforce authorization for user todos', async () => { const currentUser = 'user1'; await expect(getTodosByUser('user2', { currentUser })).rejects.toThrow('Unauthorized'); }). Test admin access: test('should allow admin to access any user todos', async () => { const todos = await getTodosByUser('user2', { currentUser: 'admin', isAdmin: true }); expect(todos).toBeDefined(); });

**[HIGH] branch: searchTodos error handling (line 119)**

**Reason:** No error handling branch exists. Database errors, connection failures, and timeout scenarios are not tested or handled.

**Suggested test:** test('should handle database errors gracefully', async () => { jest.spyOn(db, 'query').mockRejectedValue(new Error('Connection failed')); await expect(searchTodos('test')).rejects.toThrow('Failed to search todos'); });

**[MEDIUM] branch: Large result sets in all search functions (lines 119, 128, 138)**

**Reason:** No pagination means unbounded result sets. Performance and memory issues with large datasets are not tested or addressed.

**Suggested test:** test('should limit result set size', async () => { // Create 1000 todos; for (let i = 0; i < 1000; i++) await createTodo({title: `Todo ${i}`}); const results = await searchTodos('Todo'); expect(results.length).toBeLessThanOrEqual(100); // Should have max limit });

#### Refactoring Suggestions

Identified 7 critical refactoring opportunities in src/todo.ts. TOP PRIORITY: Fix 3 critical SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser by implementing parameterized queries (HIGH impact). Additional improvements include: adding authorization checks to getTodosByUser, reducing code duplication through Strategy pattern (MEDIUM impact), modernizing with query builder library like Knex.js (MEDIUM impact), extracting validation utilities (LOW impact), and improving function naming consistency (LOW impact). The security refactorings are mandatory before merge. The code duplication and modernization refactorings would significantly improve maintainability and reduce future security risks. All refactorings include specific before/after examples demonstrating the improvements.

**[HIGH IMPACT] pattern-improvement**

**Location:** searchTodos function (line 119)

Critical SQL injection vulnerability due to template literal string interpolation. User input is directly embedded in SQL query without parameterization.

**Benefits:** Eliminates SQL injection vulnerability through parameterized queries. Adds input validation to prevent empty/oversized searches. Implements error handling for better debugging. Adds result limiting (LIMIT 100) to prevent performance issues. Prevents potential database compromise, data exfiltration, and unauthorized access that could result from SQL injection attacks.

**Before:**

~~~text
export async function searchTodos(keyword: string): Promise<Todo[]> {
  const query = `SELECT * FROM todos WHERE title LIKE '%${keyword}%' OR description LIKE '%${keyword}%'`;
  const rows = await db.query(query);
  return rows as Todo[];
}
~~~

**After:**

~~~text
export async function searchTodos(keyword: string): Promise<Todo[]> {
  if (!keyword || keyword.trim().length === 0) {
    return [];
  }

  const sanitizedKeyword = keyword.trim();
  if (sanitizedKeyword.length > 100) {
    throw new Error('Search term too long');
  }

  const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2 LIMIT 100';
  const searchPattern = `%${sanitizedKeyword}%`;

  try {
    const rows = await db.query(query, [searchPattern, searchPattern]);
    return rows as Todo[];
  } catch (error) {
    logger.error('Search todos failed', { keyword: sanitizedKeyword, error });
    throw new DatabaseError('Failed to search todos');
  }
}
~~~

**[HIGH IMPACT] pattern-improvement**

**Location:** searchTodosByStatus function (line 128)

Critical SQL injection vulnerability through string concatenation. Parameter type is incorrectly defined as string instead of boolean, allowing arbitrary SQL injection.

**Benefits:** Fixes SQL injection by using parameterized query. Corrects parameter type from string to boolean for type safety. Adds runtime type validation. Implements error handling. Adds LIMIT clause for performance. Adds ORDER BY for consistent results. Prevents SQL injection attacks that could delete data, access sensitive information, or compromise the database server.

**Before:**

~~~text
export async function searchTodosByStatus(completed: string): Promise<Todo[]> {
  const sql = "SELECT * FROM todos WHERE completed = " + completed;
  const rows = await db.query(sql);
  return rows as Todo[];
}
~~~

**After:**

~~~text
export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {
  if (typeof completed !== 'boolean') {
    throw new Error('Invalid status: must be boolean');
  }

  const query = 'SELECT * FROM todos WHERE completed = $1 ORDER BY created_at DESC LIMIT 100';

  try {
    const rows = await db.query(query, [completed]);
    return rows as Todo[];
  } catch (error) {
    logger.error('Search by status failed', { completed, error });
    throw new DatabaseError('Failed to filter todos by status');
  }
}
~~~

**[HIGH IMPACT] pattern-improvement**

**Location:** getTodosByUser function (line 138)

Critical SQL injection vulnerability in JOIN query using template literals. Missing authorization checks allow users to access other users' todos without permission.

**Benefits:** Eliminates SQL injection through parameterized queries. Adds critical authorization checks to prevent unauthorized access to other users' data. Implements input validation. Adds error handling and logging. Implements pagination with LIMIT. Prevents SQL injection attacks and unauthorized data access violations that could expose private user data.

**Before:**

~~~text
export async function getTodosByUser(userId: string): Promise<Todo[]> {
  const query = `SELECT t.* FROM todos t JOIN user_todos ut ON t.id = ut.todo_id WHERE ut.user_id = '${userId}'`;
  const rows = await db.query(query);
  return rows as Todo[];
}
~~~

**After:**

~~~text
export async function getTodosByUser(
  userId: string,
  requestingUserId: string,
  isAdmin = false
): Promise<Todo[]> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId');
  }

  // Authorization: users can only access their own todos unless admin
  if (userId !== requestingUserId && !isAdmin) {
    throw new Error('Unauthorized: cannot access other users\' todos');
  }

  const query = `
    SELECT t.*
    FROM todos t
    JOIN user_todos ut ON t.id = ut.todo_id
    WHERE ut.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT 100
  `;

  try {
    const rows = await db.query(query, [userId]);
    return rows as Todo[];
  } catch (error) {
    logger.error('Get user todos failed', { userId, error });
    throw new DatabaseError('Failed to retrieve user todos');
  }
}
~~~

**[MEDIUM IMPACT] simplify**

**Location:** All three search functions (lines 119, 128, 138)

Significant code duplication in query execution pattern across all three search functions. Each follows the same pattern of validation, query building, execution, and error handling.

**Benefits:** Eliminates code duplication by centralizing common patterns. Implements Strategy pattern for extensible query building. Makes it easy to add new query types without duplicating validation/error handling. Improves testability by allowing individual query builders to be unit tested. Centralizes security controls (parameterization, validation) in one place. Improves maintainability and reduces chance of introducing bugs when adding new search functions.

**Before:**

~~~text
// Three separate functions with duplicated patterns
export async function searchTodos(keyword: string): Promise<Todo[]> { /* ... */ }
export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> { /* ... */ }
export async function getTodosByUser(userId: string): Promise<Todo[]> { /* ... */ }
~~~

**After:**

~~~text
interface QueryExecutor<T> {
  buildQuery(): string;
  getParams(): any[];
  validate(): void;
}

class SearchTodosQuery implements QueryExecutor<Todo> {
  constructor(private keyword: string) {}

  validate(): void {
    if (!this.keyword || this.keyword.trim().length === 0) {
      throw new Error('Search keyword required');
    }
    if (this.keyword.length > 100) {
      throw new Error('Search term too long');
    }
  }

  buildQuery(): string {
    return 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2 ORDER BY created_at DESC LIMIT 100';
  }

  getParams(): any[] {
    const pattern = `%${this.keyword.trim()}%`;
    return [pattern, pattern];
  }
}

class FilterByStatusQuery implements QueryExecutor<Todo> {
  constructor(private completed: boolean) {}

  validate(): void {
    if (typeof this.completed !== 'boolean') {
      throw new Error('Status must be boolean');
    }
  }

  buildQuery(): string {
    return 'SELECT * FROM todos WHERE completed = $1 ORDER BY created_at DESC LIMIT 100';
  }

  getParams(): any[] {
    return [this.completed];
  }
}

class UserTodosQuery implements QueryExecutor<Todo> {
  constructor(
    private userId: string,
    private requestingUserId: string,
    private isAdmin: boolean
  ) {}

  validate(): void {
    if (!this.userId || typeof this.userId !== 'string') {
      throw new Error('Invalid userId');
    }
    if (this.userId !== this.requestingUserId && !this.isAdmin) {
      throw new Error('Unauthorized');
    }
  }

  buildQuery(): string {
    return 'SELECT t.* FROM todos t JOIN user_todos ut ON t.id = ut.todo_id WHERE ut.user_id = $1 ORDER BY t.created_at DESC LIMIT 100';
  }

  getParams(): any[] {
    return [this.userId];
  }
}

async function executeQuery<T>(executor: QueryExecutor<T>): Promise<T[]> {
  executor.validate();

  try {
    const rows = await db.query(executor.buildQuery(), executor.getParams());
    return rows as T[];
  } catch (error) {
    logger.error('Query execution failed', { error });
    throw new DatabaseError('Database query failed');
  }
}

export async function searchTodos(keyword: string): Promise<Todo[]> {
  return executeQuery(new SearchTodosQuery(keyword));
}

export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {
  return executeQuery(new FilterByStatusQuery(completed));
}

export async function getTodosByUser(
  userId: string,
  requestingUserId: string,
  isAdmin = false
): Promise<Todo[]> {
  return executeQuery(new UserTodosQuery(userId, requestingUserId, isAdmin));
}
~~~

**[MEDIUM IMPACT] modernize**

**Location:** All search functions (lines 119, 128, 138)

Functions could leverage modern query builder library or ORM to improve security, maintainability, and developer experience.

**Benefits:** Query builder provides automatic SQL injection protection. More readable and maintainable query construction. Database-agnostic syntax allows easier migration between databases. Better TypeScript integration and IDE autocomplete. Built-in query optimization and connection pooling. Reduces likelihood of SQL injection vulnerabilities from developer errors. Easier to compose complex queries programmatically.

**Before:**

~~~text
// Raw SQL queries with manual parameterization
export async function searchTodos(keyword: string): Promise<Todo[]> {
  const query = 'SELECT * FROM todos WHERE title LIKE $1 OR description LIKE $2';
  const pattern = `%${keyword}%`;
  const rows = await db.query(query, [pattern, pattern]);
  return rows as Todo[];
}
~~~

**After:**

~~~text
// Using Knex.js query builder
import { knex } from './database';

export async function searchTodos(keyword: string): Promise<Todo[]> {
  if (!keyword || keyword.trim().length === 0) {
    return [];
  }

  const sanitizedKeyword = keyword.trim();
  const searchPattern = `%${sanitizedKeyword}%`;

  return await knex('todos')
    .where('title', 'like', searchPattern)
    .orWhere('description', 'like', searchPattern)
    .orderBy('created_at', 'desc')
    .limit(100)
    .select('*');
}

export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {
  return await knex('todos')
    .where({ completed })
    .orderBy('created_at', 'desc')
    .limit(100)
    .select('*');
}

export async function getTodosByUser(
  userId: string,
  requestingUserId: string,
  isAdmin = false
): Promise<Todo[]> {
  if (userId !== requestingUserId && !isAdmin) {
    throw new Error('Unauthorized');
  }

  return await knex('todos as t')
    .join('user_todos as ut', 't.id', 'ut.todo_id')
    .where('ut.user_id', userId)
    .orderBy('t.created_at', 'desc')
    .limit(100)
    .select('t.*');
}
~~~

**[LOW IMPACT] extract-function**

**Location:** Input validation logic across all functions

Input validation logic is duplicated or missing across functions. Should extract into reusable validation utilities.

**Benefits:** Centralizes validation logic for consistency. Makes validation rules reusable across functions. Easier to test validation logic in isolation. Improves code readability by separating concerns. Makes it easier to update validation rules in one place.

**Before:**

~~~text
export async function searchTodos(keyword: string): Promise<Todo[]> {
  if (!keyword || keyword.trim().length === 0) {
    return [];
  }
  if (keyword.length > 100) {
    throw new Error('Search term too long');
  }
  // ... rest of function
}
~~~

**After:**

~~~text
function validateSearchKeyword(keyword: string): string {
  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Search keyword must be a non-empty string');
  }

  const trimmed = keyword.trim();
  if (trimmed.length === 0) {
    throw new Error('Search keyword cannot be empty');
  }

  if (trimmed.length > 100) {
    throw new Error('Search keyword too long (max 100 characters)');
  }

  return trimmed;
}

function validateUserId(userId: string): string {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId');
  }

  // Additional format validation (e.g., UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('userId must be a valid UUID');
  }

  return userId;
}

export async function searchTodos(keyword: string): Promise<Todo[]> {
  const sanitizedKeyword = validateSearchKeyword(keyword);
  // ... rest of function
}
~~~

**[LOW IMPACT] rename**

**Location:** searchTodosByStatus function (line 128)

Function name 'searchTodosByStatus' is inconsistent with naming. This is a filter operation, not a text search, so 'getTodosByStatus' or 'filterTodosByStatus' would be more accurate.

**Benefits:** More accurate function naming improves code clarity. 'get' better indicates this is a retrieval/filter operation rather than a text search. Improves API consistency and developer experience. Makes the function's purpose immediately clear from its name.

**Before:**

~~~text
export async function searchTodosByStatus(completed: boolean): Promise<Todo[]> {
  // ...
}
~~~

**After:**

~~~text
export async function getTodosByStatus(completed: boolean): Promise<Todo[]> {
  // ...
}
~~~

---

## Report Metadata

**Generated at:** 2026-10-18T00:00:00Z

**Duration:** 0 ms

### Agent Versions

- code-quality-analyzer: a3b91e7
- test-coverage-analyzer: a294c17
- refactoring-suggester: a82006b