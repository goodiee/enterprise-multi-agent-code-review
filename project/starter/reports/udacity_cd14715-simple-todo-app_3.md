# Code Review Report

**Repository:** udacity/cd14715-simple-todo-app
**Pull Request:** #3

## Summary

| Metric | Value |
|---|---:|
| Overall Score | 32/100 |
| Files Reviewed | 1 |
| Critical Issues | 10 |
| High Priority Tests | 15 |
| Refactoring Opportunities | 10 |

## Top Recommendations

1. **[CRITICAL] Security - PCI DSS Compliance**

The code handles raw credit card data including card numbers and CVV, which violates PCI DSS compliance standards. This is a blocking issue for production deployment. Immediate action required to integrate with a PCI-compliant payment gateway (such as Stripe, PayPal, or Braintree) that uses tokenization instead of handling raw card data.

   **Files:** src/premium.ts

2. **[CRITICAL] Security - Card Validation**

Payment card validation is insufficient and lacks Luhn algorithm validation, making the system vulnerable to accepting invalid card numbers. Additionally, sensitive payment data is being logged to the console (line 121), exposing it in application logs. Implement proper card validation using industry-standard libraries and remove all logging of sensitive payment information.

   **Files:** src/premium.ts

3. **[CRITICAL] Testing - Zero Coverage**

The entire premium payment module has zero test coverage despite containing critical financial transaction logic. This represents a severe quality and compliance risk. Before any production deployment, comprehensive test suites must be implemented covering all payment validation, pricing calculations, subscription management, and error handling paths. Target minimum 90% code coverage with focus on edge cases and failure scenarios.

   **Files:** src/premium.ts

4. **[HIGH] Bug Risk - Transaction Management**

Payment processing lacks proper transaction management and atomicity guarantees. If a payment succeeds but subscription upgrade fails, the user could be charged without receiving access. Implement database transactions or compensating transaction patterns to ensure atomicity. Additionally, the payment amount is accepted from the client (line 38) which could be manipulated - always calculate pricing server-side only.

   **Files:** src/premium.ts

5. **[HIGH] Bug Risk - Date Handling**

Multiple date-handling bugs exist: (1) Card expiry validation checks beginning of month instead of end of month (line 79), causing valid cards to be rejected. (2) Year calculation doesn't handle century rollovers (line 80). (3) Subscription validity check uses '<' instead of '<=' (line 155), creating boundary issues. Fix all date comparisons to use proper end-of-month calculations and inclusive comparisons.

   **Files:** src/premium.ts

6. **[HIGH] Security - Rate Limiting**

No rate limiting exists on payment processing endpoints, making the system vulnerable to card testing attacks where attackers try multiple card numbers to find valid ones. Implement rate limiting to restrict payment attempts to 3-5 per user/IP per hour, with exponential backoff for failed attempts. Consider integrating with fraud detection services.

   **Files:** src/premium.ts

7. **[HIGH] Refactoring - Error Handling Pattern**

The code uses inconsistent error handling, mixing thrown exceptions and boolean returns, making it difficult for callers to handle errors properly. Refactor to use a consistent Result/Either pattern that returns structured success/failure objects with typed error codes and messages. This will improve error handling predictability and enable better error diagnostics.

   **Files:** src/premium.ts

8. **[MEDIUM] Maintainability - Hardcoded Business Logic**

Business logic including tax rates (8%), processing fees (2.9%), subscription durations (1 year), and feature lists are all hardcoded in the code. This makes the system inflexible for different jurisdictions, payment methods, or subscription plans. Extract these to configuration files or database tables to enable runtime management without code deployments.

   **Files:** src/premium.ts

9. **[MEDIUM] Refactoring - Separation of Concerns**

The file mixes payment validation, payment processing, and subscription management concerns in a single module. This violates the Single Responsibility Principle and makes testing difficult. Refactor into separate modules: PaymentValidator (card validation logic), PaymentProcessor (payment gateway integration), and SubscriptionManager (subscription CRUD operations). Use dependency injection to wire these together in a PremiumService class.

   **Files:** src/premium.ts

10. **[MEDIUM] Performance - Database Optimization**

Database queries lack proper indexing and use SELECT * instead of specific columns. Ensure user_id columns have indexes for fast lookups, and select only required columns to reduce network overhead. Consider moving some validation logic (like expiry checks) into SQL queries to leverage database indexing and reduce application-level processing.

   **Files:** src/premium.ts


## Detailed File Reviews

### src/premium.ts

**Quality Score:** 32/100

**Estimated Test Coverage:** 0%

**Tests Present:** No

#### Code Quality

Critical security vulnerabilities detected in payment processing code. The file violates PCI DSS compliance by handling raw credit card data including CVV storage, lacks proper card validation (no Luhn algorithm), and logs sensitive payment information. Multiple high-severity bugs exist in date handling, payment amount validation, and transaction management. The code lacks proper error handling, has hardcoded business logic, missing rate limiting, and no test coverage for critical payment flows. Immediate refactoring required to use a PCI-compliant payment gateway with tokenization, implement proper validation, add comprehensive error handling, and create extensive test coverage before production use.

**[CRITICAL] security — Line 17**

Storing raw credit card numbers (cardNumber) in plain text violates PCI DSS compliance requirements. Credit card data should never be stored or transmitted without encryption and tokenization.

**Suggestion:** Use a PCI-compliant payment gateway (Stripe, PayPal, etc.) with tokenization. Never handle raw card data directly. Replace cardNumber with a payment token from the gateway.

**[CRITICAL] security — Line 19**

Storing CVV in any form (even temporarily in memory) violates PCI DSS rules. CVV must never be stored after authorization.

**Suggestion:** Remove CVV from the PaymentDetails interface. Pass it directly to the payment gateway API without storing it in variables or objects.

**[CRITICAL] security — Line 64**

Card number validation only checks length, which is insufficient. No Luhn algorithm validation is performed, allowing invalid card numbers to pass.

**Suggestion:** Implement Luhn algorithm validation to verify card number integrity. Consider using a library like 'card-validator' for comprehensive validation.

**[CRITICAL] security — Line 121**

Logging full card numbers to console (payment object contains cardNumber) exposes sensitive payment data in logs, violating PCI DSS.

**Suggestion:** Never log payment objects containing sensitive data. If error logging is needed, log only sanitized information like transaction IDs or masked card numbers (last 4 digits).

**[HIGH] security — Line 116**

SQL query uses parameterized queries but stores last four digits of card number. While better than full numbers, this should be part of an audit trail with proper access controls.

**Suggestion:** Ensure the payments table has proper access controls and encryption at rest. Consider using a separate audit logging system with enhanced security for payment records.

**[HIGH] bug-risk — Line 79**

Date comparison for expiry validation is flawed. It checks if the expiry date is less than current date, but should check end of month. A card expiring '12/25' is valid through December 31, 2025, not December 1.

**Suggestion:** Set the expiry date to the last day of the expiry month: 'const expiryDateObj = new Date(2000 + parseInt(year), parseInt(month), 0);' to get the last day of the previous month, or use parseInt(month) with day set to last day.

**[HIGH] bug-risk — Line 80**

Year calculation assumes '2000 + year' but doesn't handle year rollovers correctly. In 2030+, a card with '29' would be interpreted as 2029 (past) instead of 2029 (could be valid).

**Suggestion:** Implement proper century handling. If parsed year + 2000 < current year, assume next century: 'const fullYear = 2000 + parseInt(year); const century = fullYear < currentYear ? fullYear + 100 : fullYear;'

**[HIGH] bug-risk — Line 38**

Payment amount validation compares user-supplied amount against calculated price, but doesn't verify the calculation was done correctly client-side. Users could manipulate the amount parameter.

**Suggestion:** Remove 'amount' from PaymentDetails interface. Always calculate the amount server-side based on tier. Never trust client-provided pricing: 'const amount = calculateSubscriptionPrice(tier);' then charge this amount directly.

**[HIGH] bug-risk — Line 48**

Payment failure returns 'false' but doesn't rollback or handle the failed state properly. User might be charged but not upgraded, or vice versa.

**Suggestion:** Implement proper transaction handling with rollback capabilities. Use database transactions or implement compensating transactions. Throw an error instead of returning false to trigger proper error handling.

**[HIGH] bug-risk — Line 155**

Date comparison for subscription validity uses '<' operator which fails at exact boundary. If validUntil is midnight, the subscription becomes invalid at that exact moment.

**Suggestion:** Use '<=' for inclusive comparison or clarify the business logic. Consider using a grace period: 'if (validUntil <= new Date())' or add a day to validUntil when creating subscriptions.

**[HIGH] security — Line 113**

No rate limiting on payment processing allows potential abuse through repeated payment attempts (card testing attacks).

**Suggestion:** Implement rate limiting on payment endpoints. Limit attempts per user/IP to 3-5 per hour. Use exponential backoff for failed attempts. Consider integrating with fraud detection services.

**[MEDIUM] security — Line 146**

SQL query is vulnerable if database query method doesn't properly escape parameters. The JSON.stringify output could contain malicious content if features array is compromised.

**Suggestion:** Ensure db.query properly sanitizes all parameters. Consider using an ORM like TypeORM or Prisma for type-safe database operations. Store features as a proper JSON column type with validation.

**[MEDIUM] bug-risk — Line 27**

Function returns boolean for payment success/failure, but throws errors for validation failures. Inconsistent error handling makes it difficult for callers to handle all failure cases uniformly.

**Suggestion:** Use consistent error handling. Either throw errors for all failures or return a result object: '{ success: boolean, error?: string }'. This makes error handling predictable.

**[MEDIUM] maintainability — Line 100**

Hardcoded tax rate (0.08) and processing fee (0.029) don't account for different jurisdictions or payment methods. This will cause incorrect pricing for international users.

**Suggestion:** Move tax rates and fees to configuration based on user location and payment method. Use a tax calculation service for accuracy. Consider: 'getTaxRate(userLocation)' and 'getProcessingFee(paymentMethod)'.

**[MEDIUM] maintainability — Line 131**

Feature lists are hardcoded and duplicated. Adding/removing features requires code changes in multiple places.

**Suggestion:** Define features in a configuration object or database: 'const TIER_FEATURES = { premium: [...], enterprise: [...] }'. This enables runtime feature management without code deployment.

**[MEDIUM] bug-risk — Line 159**

JSON.parse is called without error handling. Corrupted data in the database will cause the entire function to throw unhandled exceptions.

**Suggestion:** Wrap JSON.parse in try-catch blocks: 'try { return JSON.parse(subscription.features); } catch { return []; }'. Consider migrating to a proper JSON column type with database-level validation.

**[MEDIUM] performance — Line 150**

Database queries in hasFeatureAccess and getUserSubscription are not using indexes. The WHERE clause on user_id should have an index for fast lookups.

**Suggestion:** Ensure database has an index on subscriptions(user_id). Add a migration: 'CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);'. Consider adding a composite index if querying by user_id and valid_until together.

**[MEDIUM] performance — Line 165**

getUserSubscription queries all columns with SELECT * which is inefficient and may expose unnecessary data.

**Suggestion:** Select only required columns: 'SELECT user_id, tier, valid_until, features FROM subscriptions WHERE user_id = $1'. This reduces network overhead and improves query performance.

**[LOW] performance — Line 151**

hasFeatureAccess performs two operations (expiry check and feature check) that could be done in a single database query with a WHERE clause.

**Suggestion:** Move validation to SQL: 'SELECT features FROM subscriptions WHERE user_id = $1 AND valid_until >= NOW()'. This reduces application logic and leverages database indexing.

**[LOW] bug-risk — Line 64**

Card number validation doesn't check if the string contains only digits. Spaces, hyphens, or letters would pass the length check but are invalid.

**Suggestion:** Add digit-only validation: 'if (!/^\d{16}$/.test(cardNumber)) return false;'. Consider also accepting and normalizing common formats like '1234-5678-9012-3456'.

**[LOW] bug-risk — Line 68**

CVV validation doesn't verify it contains only digits, allowing non-numeric characters.

**Suggestion:** Add digit validation: 'if (!/^\d{3,4}$/.test(cvv)) return false;'. This ensures CVV is numeric before processing.

**[LOW] maintainability — Line 138**

Subscription duration is hardcoded to 1 year. This lacks flexibility for different subscription periods (monthly, quarterly).

**Suggestion:** Add a duration parameter to the upgrade function: 'upgradeUserSubscription(userId, tier, duration)' and calculate validUntil based on the duration type.

**[LOW] maintainability — Line 143**

SQL query uses ON CONFLICT without explicitly handling the conflict case logic. The behavior isn't clear from the code.

**Suggestion:** Add a comment explaining the upsert logic or split into separate INSERT/UPDATE operations for clarity. Consider: '// Upsert: Create new subscription or extend existing one'.

**[INFO] best-practice — Line 28**

Missing input validation for userId parameter. Empty strings or invalid formats could cause database issues.

**Suggestion:** Add userId validation at the start: 'if (!userId || typeof userId !== "string") throw new Error("Invalid userId");'. Consider using a UUID validator if using UUID format.

**[INFO] best-practice — Line 1**

File contains critical payment processing logic without comprehensive test coverage as noted in comments. This is a serious quality and compliance risk.

**Suggestion:** Implement comprehensive unit tests covering: payment validation, pricing calculations, edge cases (expired cards, insufficient funds), error handling, and database operations. Aim for >90% code coverage.

**[INFO] maintainability — Line 113**

Simulated payment gateway call should be abstracted to allow different payment providers and easier testing.

**Suggestion:** Create a PaymentGateway interface with implementations for different providers: 'interface PaymentGateway { charge(payment: PaymentToken, amount: number): Promise<PaymentResult> }'. Inject the gateway via dependency injection.

**[INFO] maintainability — Line 9**

Database module is imported without type safety for query results. TypeScript benefits are lost without proper typing.

**Suggestion:** Use a typed ORM (Prisma, TypeORM, Drizzle) or define explicit result types: 'interface SubscriptionRow { user_id: string; tier: string; valid_until: Date; features: string; }'

#### Test Coverage

No test coverage exists for src/premium.ts. This file contains critical payment processing, card validation, and subscription management logic with zero test coverage. All 5 exported functions and 3 internal helper functions are completely untested. Critical risks include: untested payment validation that could allow fraudulent transactions, untested pricing calculations that could cause revenue loss, untested subscription upgrades that could deny paid users access, and untested expiry checks that could allow unauthorized feature access. Immediate action required to add comprehensive test coverage before deploying to production.

**Related test files:** None identified

**[CRITICAL] function: processPremiumPayment (line 27)**

**Reason:** processPremiumPayment is the main payment processing function handling financial transactions. No test coverage exists for this critical business logic.

**Suggested test:** Create comprehensive tests including: (1) successful payment flow with valid details, (2) rejection of invalid payment details, (3) handling of insufficient payment amount, (4) handling of payment gateway failures, (5) verification that subscription upgrade occurs after successful payment.

**[CRITICAL] function: validatePaymentDetails (line 63)**

**Reason:** validatePaymentDetails performs critical card validation that prevents fraudulent transactions. All validation branches need testing.

**Suggested test:** Test all validation branches: (1) valid 16-digit card number, (2) invalid card number lengths (15, 17, etc.), (3) valid CVV (3 and 4 digits), (4) invalid CVV lengths, (5) valid expiry format (MM/YY), (6) invalid expiry formats, (7) expired cards, (8) cards expiring in future, (9) edge cases like current month/year.

**[HIGH] branch: Card number length validation (lines 68-70)**

**Reason:** Card number length validation branch is untested. Invalid card numbers could lead to payment failures.

**Suggested test:** Test with card numbers of various lengths: 15 digits (should fail), 16 digits (should pass), 17 digits (should fail), empty string, and non-numeric values.

**[HIGH] branch: CVV validation (lines 73-75)**

**Reason:** CVV validation branch is untested. Incorrect CVV handling could expose security vulnerabilities.

**Suggested test:** Test CVV validation with: 3-digit CVV (should pass for Visa/MC), 4-digit CVV (should pass for Amex), 2-digit CVV (should fail), 5-digit CVV (should fail), empty CVV, non-numeric CVV.

**[HIGH] branch: Expiry date format validation (lines 78-81)**

**Reason:** Expiry date format validation is untested. Malformed dates could bypass validation.

**Suggested test:** Test expiry format validation with: valid format '12/25', invalid formats like '13/25' (invalid month), '1/25' (missing leading zero), '12/2025' (4-digit year), 'Dec/25', empty string, special characters.

**[CRITICAL] branch: Expired card detection (lines 84-89)**

**Reason:** Expired card detection is untested. Accepting expired cards would result in failed transactions.

**Suggested test:** Test expiry validation with: (1) card expired last month, (2) card expired last year, (3) card expiring current month (edge case), (4) card expiring next month, (5) card expiring in future years.

**[CRITICAL] function: calculateSubscriptionPrice (line 97)**

**Reason:** calculateSubscriptionPrice computes billing amounts. Incorrect calculations would cause revenue loss or customer disputes.

**Suggested test:** Test price calculations: (1) premium tier returns correct amount (base $9.99 + 8% tax + 2.9% fee = $11.08), (2) enterprise tier returns correct amount (base $49.99 + tax + fee = $55.44), (3) verify all pricing components are applied correctly.

**[HIGH] edge-case: Pricing calculation floating-point (lines 97-111)**

**Reason:** Pricing calculation involves floating-point arithmetic which can have precision issues.

**Suggested test:** Test floating-point precision: ensure calculated amounts are rounded correctly to 2 decimal places, test that $9.99 * 1.109 doesn't result in precision errors, verify amounts match expected values exactly.

**[CRITICAL] function: chargeCard (line 116)**

**Reason:** chargeCard executes actual payment transactions and database writes. Database errors and payment failures must be handled properly.

**Suggested test:** Test payment processing: (1) successful payment inserts record with 'completed' status, (2) database errors are caught and return false, (3) card last 4 digits are extracted correctly, (4) error logging occurs on failure, (5) verify transaction rollback on errors.

**[CRITICAL] branch: Database error handling in payment (lines 122-127)**

**Reason:** Database error handling in payment processing is untested. Failures could leave system in inconsistent state.

**Suggested test:** Mock db.query to throw errors and verify: (1) function returns false, (2) error is logged to console, (3) no partial data is committed, (4) exception does not propagate to caller.

**[CRITICAL] function: upgradeUserSubscription (line 133)**

**Reason:** upgradeUserSubscription grants premium access. Errors could prevent paid users from accessing features.

**Suggested test:** Test subscription upgrade: (1) premium tier gets correct features array, (2) enterprise tier gets all features including api_access and team_collaboration, (3) valid_until is set to 1 year from now, (4) database upsert works for new and existing users, (5) features are JSON-serialized correctly.

**[HIGH] branch: Premium vs enterprise features (lines 134-137)**

**Reason:** Premium vs enterprise feature assignment logic is untested. Wrong features would violate tier boundaries.

**Suggested test:** Verify feature assignment: (1) premium gets exactly ['unlimited_todos', 'priority_support', 'custom_themes'], (2) enterprise gets all premium features plus ['api_access', 'team_collaboration'], (3) no features are duplicated, (4) features are in correct order.

**[MEDIUM] edge-case: Date manipulation for subscription (lines 139-140)**

**Reason:** Date manipulation for subscription expiry could have timezone or leap year edge cases.

**Suggested test:** Test date calculations: (1) subscription purchased on Feb 29 (leap year), (2) different timezones, (3) daylight saving time transitions, (4) verify exactly 365 days added for non-leap years, (5) verify validUntil is stored in correct format.

**[HIGH] function: hasFeatureAccess (line 148)**

**Reason:** hasFeatureAccess controls access to premium features. Bypass would allow unauthorized access.

**Suggested test:** Test feature access control: (1) user with valid subscription and feature returns true, (2) user without subscription returns false, (3) expired subscription returns false, (4) valid subscription without requested feature returns false, (5) handles missing user gracefully.

**[HIGH] branch: No subscription found (lines 151-154)**

**Reason:** No subscription found case is untested. Should deny access to users without subscriptions.

**Suggested test:** Test when db.query returns empty array: verify function returns false and does not throw exceptions.

**[CRITICAL] branch: Expired subscription check (lines 158-161)**

**Reason:** Expired subscription check is untested. Expired users could access premium features incorrectly.

**Suggested test:** Test expiry validation: (1) subscription expired yesterday returns false, (2) subscription expiring today (edge case), (3) subscription expiring tomorrow returns true, (4) subscription from last year returns false.

**[MEDIUM] edge-case: JSON parsing of features (lines 164-165)**

**Reason:** JSON parsing of features array from database could fail with malformed data.

**Suggested test:** Test JSON parsing edge cases: (1) valid JSON array, (2) empty array, (3) malformed JSON (should throw), (4) null value, (5) non-array JSON, (6) JSON with unexpected types.

**[MEDIUM] function: getUserSubscription (line 172)**

**Reason:** getUserSubscription retrieves user subscription data. Errors could affect billing and support systems.

**Suggested test:** Test subscription retrieval: (1) existing user returns complete subscription object, (2) non-existent user returns null, (3) all fields are mapped correctly (userId, tier, validUntil, features), (4) features are parsed from JSON, (5) date conversion works properly.

**[CRITICAL] branch: Invalid payment details error (lines 36-38)**

**Reason:** Invalid payment details error handling in processPremiumPayment is untested.

**Suggested test:** Test that processPremiumPayment throws 'Invalid payment details' error when validatePaymentDetails returns false, and verify no database changes occur.

**[CRITICAL] branch: Insufficient payment amount (lines 43-45)**

**Reason:** Insufficient payment amount error handling is untested. Underpayment should be rejected.

**Suggested test:** Test insufficient payment scenarios: (1) payment.amount exactly equals tier price (should pass), (2) payment.amount is $0.01 less than tier price (should throw), (3) payment.amount is $0 (should throw), (4) payment.amount is negative (should throw).

**[CRITICAL] branch: Payment gateway failure (lines 48-51)**

**Reason:** Payment gateway failure handling in processPremiumPayment is untested.

**Suggested test:** Mock chargeCard to return false and verify: (1) processPremiumPayment returns false, (2) subscription is NOT upgraded, (3) no partial state changes occur.

**[HIGH] edge-case: Transaction atomicity (lines 27-56)**

**Reason:** Transaction atomicity in processPremiumPayment is untested. Payment success but upgrade failure could charge user without granting access.

**Suggested test:** Test failure scenarios: (1) chargeCard succeeds but upgradeUserSubscription throws - verify proper rollback or compensation logic, (2) test race conditions with concurrent payments, (3) verify idempotency if function is called twice.

**[MEDIUM] edge-case: Tier parameter validation (lines 27-56)**

**Reason:** Input validation for tier parameter in processPremiumPayment is untested.

**Suggested test:** Test tier parameter validation: (1) 'premium' and 'enterprise' are accepted, (2) 'free' tier is not allowed (type system should prevent but verify), (3) invalid tier values are rejected.

#### Refactoring Suggestions

The premium.ts file has significant refactoring opportunities focused on: (1) Extracting complex validation logic into focused, testable functions, (2) Implementing Result/Either pattern for consistent error handling instead of mixed exceptions and booleans, (3) Centralizing configuration (pricing, features) to reduce duplication, (4) Modernizing TypeScript patterns with optional chaining and type assertions, (5) Separating concerns into distinct modules/classes for payment validation, processing, and subscription management. Highest impact improvements are adopting the Result pattern for error handling and separating concerns into focused modules, which will significantly improve testability and maintainability of this critical payment logic.

**[MEDIUM IMPACT] extract-function**

**Location:** lines 88-92

Extract expiry date parsing logic from validatePaymentDetails into a separate function for better testability and reusability.

**Benefits:** Improves testability by isolating date parsing logic, makes expiry validation reusable, and improves readability with a descriptive function name.

**Before:**

~~~text
const [month, year] = expiryDate.split('/');
const expiryDateObj = new Date(2000 + parseInt(year), parseInt(month) - 1);

if (expiryDateObj < new Date()) {
  return false;
}
~~~

**After:**

~~~text
function parseExpiryDate(expiryDate: string): Date {
  const [month, year] = expiryDate.split('/');
  return new Date(2000 + parseInt(year, 10), parseInt(month, 10) - 1);
}

function isCardExpired(expiryDate: string): boolean {
  const expiryDateObj = parseExpiryDate(expiryDate);
  return expiryDateObj < new Date();
}

// In validatePaymentDetails:
if (isCardExpired(expiryDate)) {
  return false;
}
~~~

**[MEDIUM IMPACT] extract-function**

**Location:** lines 139-142

Extract feature list determination into a configuration-based function to improve maintainability and make tier features easier to manage.

**Benefits:** Centralizes feature configuration, eliminates duplication, makes it easier to add new tiers or modify features, and improves testability.

**Before:**

~~~text
const features = tier === 'premium'
  ? ['unlimited_todos', 'priority_support', 'custom_themes']
  : ['unlimited_todos', 'priority_support', 'custom_themes', 'api_access', 'team_collaboration'];
~~~

**After:**

~~~text
const TIER_FEATURES: Record<'premium' | 'enterprise', string[]> = {
  premium: ['unlimited_todos', 'priority_support', 'custom_themes'],
  enterprise: ['unlimited_todos', 'priority_support', 'custom_themes', 'api_access', 'team_collaboration']
};

function getFeaturesForTier(tier: 'premium' | 'enterprise'): string[] {
  return TIER_FEATURES[tier];
}

// In upgradeUserSubscription:
const features = getFeaturesForTier(tier);
~~~

**[MEDIUM IMPACT] simplify**

**Location:** lines 65-96

Simplify validatePaymentDetails by extracting individual validation rules into separate, focused functions.

**Benefits:** Each validation rule is now independently testable, more readable, reusable, and follows Single Responsibility Principle. Also adds numeric validation for card number and CVV.

**Before:**

~~~text
function validatePaymentDetails(payment: PaymentDetails): boolean {
  const { cardNumber, expiryDate, cvv } = payment;

  if (cardNumber.length !== 16) {
    return false;
  }

  if (cvv.length !== 3 && cvv.length !== 4) {
    return false;
  }

  const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
  if (!expiryRegex.test(expiryDate)) {
    return false;
  }

  const [month, year] = expiryDate.split('/');
  const expiryDateObj = new Date(2000 + parseInt(year), parseInt(month) - 1);

  if (expiryDateObj < new Date()) {
    return false;
  }

  return true;
}
~~~

**After:**

~~~text
function isValidCardNumber(cardNumber: string): boolean {
  return cardNumber.length === 16 && /^\d+$/.test(cardNumber);
}

function isValidCVV(cvv: string): boolean {
  return (cvv.length === 3 || cvv.length === 4) && /^\d+$/.test(cvv);
}

function isValidExpiryFormat(expiryDate: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate);
}

function isCardExpired(expiryDate: string): boolean {
  const [month, year] = expiryDate.split('/');
  const expiryDateObj = new Date(2000 + parseInt(year, 10), parseInt(month, 10) - 1);
  return expiryDateObj < new Date();
}

function validatePaymentDetails(payment: PaymentDetails): boolean {
  const { cardNumber, expiryDate, cvv } = payment;

  return isValidCardNumber(cardNumber) &&
         isValidCVV(cvv) &&
         isValidExpiryFormat(expiryDate) &&
         !isCardExpired(expiryDate);
}
~~~

**[LOW IMPACT] modernize**

**Location:** lines 104-115

Use const for immutable pricing configuration and consider extracting to a configuration module for better maintainability.

**Benefits:** Centralizes pricing configuration, prevents accidental mutations with 'as const', fixes floating point precision issues with toFixed, and makes configuration easier to modify.

**Before:**

~~~text
function calculateSubscriptionPrice(tier: 'premium' | 'enterprise'): number {
  const PRICING = {
    premium: 9.99,
    enterprise: 49.99
  };

  const basePrice = PRICING[tier];
  const TAX_RATE = 0.08;
  const PROCESSING_FEE = 0.029;

  const tax = basePrice * TAX_RATE;
  const fee = basePrice * PROCESSING_FEE;

  return basePrice + tax + fee;
}
~~~

**After:**

~~~text
const PRICING_CONFIG = {
  tiers: {
    premium: 9.99,
    enterprise: 49.99
  },
  taxRate: 0.08,
  processingFeeRate: 0.029
} as const;

function calculateSubscriptionPrice(tier: 'premium' | 'enterprise'): number {
  const basePrice = PRICING_CONFIG.tiers[tier];
  const tax = basePrice * PRICING_CONFIG.taxRate;
  const fee = basePrice * PRICING_CONFIG.processingFeeRate;

  return Number((basePrice + tax + fee).toFixed(2));
}
~~~

**[HIGH IMPACT] pattern-improvement**

**Location:** lines 28-56

Implement Result/Either pattern for error handling instead of throwing exceptions and returning boolean, providing better error context.

**Benefits:** Eliminates mixed error handling (exceptions + boolean returns), provides structured error types for better error handling, enables type-safe error handling, and improves API consistency.

**Before:**

~~~text
export async function processPremiumPayment(
  userId: string,
  payment: PaymentDetails,
  tier: 'premium' | 'enterprise'
): Promise<boolean> {
  if (!validatePaymentDetails(payment)) {
    throw new Error('Invalid payment details');
  }

  const amount = calculateSubscriptionPrice(tier);

  if (payment.amount < amount) {
    throw new Error('Insufficient payment amount');
  }

  const paymentSuccessful = await chargeCard(payment, amount);

  if (!paymentSuccessful) {
    return false;
  }

  await upgradeUserSubscription(userId, tier);

  return true;
}
~~~

**After:**

~~~text
type PaymentResult =
  | { success: true; subscriptionId: string }
  | { success: false; error: 'INVALID_PAYMENT_DETAILS' | 'INSUFFICIENT_AMOUNT' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_UPDATE_FAILED'; message: string };

export async function processPremiumPayment(
  userId: string,
  payment: PaymentDetails,
  tier: 'premium' | 'enterprise'
): Promise<PaymentResult> {
  if (!validatePaymentDetails(payment)) {
    return {
      success: false,
      error: 'INVALID_PAYMENT_DETAILS',
      message: 'Card number, CVV, or expiry date is invalid'
    };
  }

  const amount = calculateSubscriptionPrice(tier);

  if (payment.amount < amount) {
    return {
      success: false,
      error: 'INSUFFICIENT_AMOUNT',
      message: `Payment amount ${payment.amount} is less than required ${amount}`
    };
  }

  const chargeResult = await chargeCard(payment, amount);

  if (!chargeResult.success) {
    return {
      success: false,
      error: 'PAYMENT_FAILED',
      message: chargeResult.error || 'Payment processing failed'
    };
  }

  try {
    await upgradeUserSubscription(userId, tier);
    return { success: true, subscriptionId: userId };
  } catch (error) {
    return {
      success: false,
      error: 'SUBSCRIPTION_UPDATE_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
~~~

**[MEDIUM IMPACT] pattern-improvement**

**Location:** lines 121-133

Return a structured result object instead of boolean to provide more context about payment failures.

**Benefits:** Provides transaction ID for auditing, enables better error diagnostics, and maintains consistency with result pattern approach.

**Before:**

~~~text
async function chargeCard(payment: PaymentDetails, amount: number): Promise<boolean> {
  const query = 'INSERT INTO payments (card_last_four, amount, status) VALUES ($1, $2, $3)';
  const lastFour = payment.cardNumber.slice(-4);

  try {
    await db.query(query, [lastFour, amount, 'completed']);
    return true;
  } catch (error) {
    console.error('Payment failed:', error);
    return false;
  }
}
~~~

**After:**

~~~text
interface ChargeResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

async function chargeCard(payment: PaymentDetails, amount: number): Promise<ChargeResult> {
  const query = 'INSERT INTO payments (card_last_four, amount, status) VALUES ($1, $2, $3) RETURNING id';
  const lastFour = payment.cardNumber.slice(-4);

  try {
    const result = await db.query(query, [lastFour, amount, 'completed']);
    return {
      success: true,
      transactionId: result.rows[0]?.id
    };
  } catch (error) {
    console.error('Payment failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown payment error'
    };
  }
}
~~~

**[LOW IMPACT] simplify**

**Location:** lines 160-173

Simplify hasFeatureAccess by extracting subscription validity check and using optional chaining.

**Benefits:** Extracts reusable validation logic, uses modern optional chaining, adds type safety for parsed JSON, and improves readability.

**Before:**

~~~text
export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const query = 'SELECT features, valid_until FROM subscriptions WHERE user_id = $1';
  const rows = await db.query(query, [userId]);

  if (rows.length === 0) {
    return false;
  }

  const subscription = rows[0];
  const validUntil = new Date(subscription.valid_until);

  if (validUntil < new Date()) {
    return false;
  }

  const features = JSON.parse(subscription.features);
  return features.includes(feature);
}
~~~

**After:**

~~~text
function isSubscriptionValid(validUntil: Date): boolean {
  return validUntil >= new Date();
}

export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const query = 'SELECT features, valid_until FROM subscriptions WHERE user_id = $1';
  const result = await db.query(query, [userId]);
  const subscription = result.rows?.[0];

  if (!subscription) {
    return false;
  }

  const validUntil = new Date(subscription.valid_until);
  if (!isSubscriptionValid(validUntil)) {
    return false;
  }

  const features = JSON.parse(subscription.features) as string[];
  return features.includes(feature);
}
~~~

**[LOW IMPACT] modernize**

**Location:** lines 179-195

Modernize getUserSubscription with better null handling and type safety.

**Benefits:** Uses optional chaining for safer property access, adds explicit type assertions for database values, and improves null handling consistency.

**Before:**

~~~text
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const query = 'SELECT * FROM subscriptions WHERE user_id = $1';
  const rows = await db.query(query, [userId]);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    userId: row.user_id,
    tier: row.tier,
    validUntil: new Date(row.valid_until),
    features: JSON.parse(row.features)
  };
}
~~~

**After:**

~~~text
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const query = 'SELECT * FROM subscriptions WHERE user_id = $1';
  const result = await db.query(query, [userId]);
  const row = result.rows?.[0];

  if (!row) {
    return null;
  }

  return {
    userId: row.user_id,
    tier: row.tier as Subscription['tier'],
    validUntil: new Date(row.valid_until),
    features: JSON.parse(row.features) as string[]
  };
}
~~~

**[LOW IMPACT] extract-function**

**Location:** lines 144-145

Extract subscription expiration date calculation into a reusable utility function.

**Benefits:** Makes expiration calculation reusable, testable, and flexible for different subscription durations. Improves readability.

**Before:**

~~~text
const validUntil = new Date();
validUntil.setFullYear(validUntil.getFullYear() + 1);
~~~

**After:**

~~~text
function calculateSubscriptionExpiry(durationYears: number = 1): Date {
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + durationYears);
  return validUntil;
}

// In upgradeUserSubscription:
const validUntil = calculateSubscriptionExpiry();
~~~

**[HIGH IMPACT] pattern-improvement**

**Location:** lines 1-195

Separate concerns by splitting payment processing, validation, and subscription management into different modules or classes.

**Benefits:** Follows Single Responsibility Principle, improves testability through dependency injection, enables better code organization, makes mocking easier for tests, and improves maintainability.

**Before:**

~~~text
// All functions in single file mixing payment, validation, and subscription logic
~~~

**After:**

~~~text
// payment-validator.ts
export class PaymentValidator {
  validatePaymentDetails(payment: PaymentDetails): ValidationResult { /*...*/ }
  private isValidCardNumber(cardNumber: string): boolean { /*...*/ }
  private isValidCVV(cvv: string): boolean { /*...*/ }
  private isValidExpiryFormat(expiryDate: string): boolean { /*...*/ }
  private isCardExpired(expiryDate: string): boolean { /*...*/ }
}

// payment-processor.ts
export class PaymentProcessor {
  async chargeCard(payment: PaymentDetails, amount: number): Promise<ChargeResult> { /*...*/ }
}

// subscription-manager.ts
export class SubscriptionManager {
  async upgradeUserSubscription(userId: string, tier: SubscriptionTier): Promise<void> { /*...*/ }
  async hasFeatureAccess(userId: string, feature: string): Promise<boolean> { /*...*/ }
  async getUserSubscription(userId: string): Promise<Subscription | null> { /*...*/ }
  private getFeaturesForTier(tier: SubscriptionTier): string[] { /*...*/ }
}

// premium-service.ts
export class PremiumService {
  constructor(
    private validator: PaymentValidator,
    private processor: PaymentProcessor,
    private subscriptionManager: SubscriptionManager
  ) {}

  async processPremiumPayment(/*...*/) { /*...*/ }
}
~~~

---

## Report Metadata

**Generated at:** 2026-10-18T12:00:00Z

**Duration:** 45.0 seconds

### Agent Versions

- code-quality-analyzer: a9b305c
- test-coverage-analyzer: a7c7b76
- refactoring-suggester: a9dae14