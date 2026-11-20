# RayGuard Firestore Security Specification

## Collections & Access Matrix

1. `/users/{userId}` (`UserProfile`)
   - Contains public-safe profile metadata (`uid`, `displayName`, `photoUrl`, `role`, `createdAt`, `updatedAt`). No PII (`email`) stored here.
   - `get`, `create`, `update`: Owner only (`request.auth.uid == userId && email_verified`) or Admin (`get`, `update` role only). Self-create locks `role == 'analyst'`; self-update cannot alter `role`, `uid`, or `createdAt`.
   - `list`, `delete`: Denied on client.

2. `/users/{userId}/private/{docId}` (`UserPrivateAccount`)
   - Owner-isolated PII (`uid`, `email`, `createdAt`, `updatedAt`). `docId` must be `account`.
   - `get`, `create`, `update`: Strict owner only (`request.auth.uid == userId && email_verified`). Admin override intentionally omitted for PII confidentiality.
   - `list`, `delete`: Denied.

3. `/users/{userId}/notes/{noteId}` (`DisputeNote`)
   - Investigation notes and decision overrides authored by the signed-in analyst.
   - `get`, `create`, `update`, `delete`: Owner only (`isOwner(userId)`) + strict `isValidId(noteId)` (`^[a-zA-Z0-9_\-]+$`, 1..128 chars).
   - `list`: Owner only with `resource.data.uid == request.auth.uid`.
   - Invariants: `uid` matches `request.auth.uid`, `disputeId` matches `^[a-zA-Z0-9_\-]+$`, `note` size `1..2000`, `decisionOverride in ['NONE', 'CONTEST', 'ACCEPT', 'ESCALATE']`, `createdAt == request.time` on create, immutable `uid`/`createdAt`/`disputeId` on update.

4. `/users/{userId}/policies/{policyId}` (`UserPolicyPreset`)
   - Persisted guardrail thresholds and card-network templates (`policyId` matches `^[a-zA-Z0-9_\-]+$`).
   - `get`, `create`, `update`: Owner only + numeric bounds checks (`gatewayDisputeFeeInr` 0..5000, `internalOpsCostInr` 0..2000, `autoContestThreshold` 0.5..0.95, `humanReviewFloor` 0.1..0.65, `courierTimeoutMs` int 500..10000).
   - `list`: Owner only with `resource.data.uid == request.auth.uid`.

5. `/users/{userId}/voiceSessions/{sessionId}` (`VoiceSessionLog`)
   - Saved Gemini Live voice transcripts (`sessionId` matches `^[a-zA-Z0-9_\-]+$`).
   - `get`, `list`, `create`, `delete`: Owner only (`list` enforces `resource.data.uid == request.auth.uid`); `summary` `1..500`, `transcriptText` `1..12000`, `turnCount` int `1..200`.

## The Dirty Dozen Rejection Guarantees
1. Unauthenticated read/write -> Denied (`isAuthenticated()` fails).
2. Unverified email auth token -> Denied (`email_verified == true` enforced).
3. Cross-tenant IDOR read/write on `/users/victim_uid/notes/*` -> Denied (`isOwner(userId)` fails).
4. Client setting `uid` to another user inside document payload -> Denied (`incoming().uid == request.auth.uid`).
5. Privilege escalation (`role: 'admin'`) on `/users/{uid}` create or update -> Denied.
6. Mass assignment / unvalidated extra fields -> Denied (`hasOnly(...)` enforced).
7. Timestamp spoofing (`createdAt` != `request.time`) -> Denied.
8. Mutation of immutable fields (`uid`, `createdAt`) on update -> Denied.
9. Oversized strings (`note` > 2000 chars, `transcriptText` > 12000 chars) -> Denied.
10. Out-of-bounds numeric thresholds (`autoContestThreshold: 1.5`) -> Denied.
11. Malicious path traversal IDs (`../admin`) -> Denied (`isValidId` regex fails).
12. Unscoped collection listing without `resource.data.uid == request.auth.uid` -> Denied.
