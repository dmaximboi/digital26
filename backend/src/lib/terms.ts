export const AGREEMENT_TERMS = `
THE DIGITAL 26 — SERVICE AGREEMENT LETTER

Based on our discussion, the Client confirms they have accepted and want The Digital 26’s services
(website building, collaboration, or related digital work as tagged on this letter).

By signing, the Client agrees to our consent, working terms, and service process. The Client relies on
The Digital 26 to deliver with honesty and care.

The Digital 26 upholds utmost truth and loyalty in our work. We condemn any form of scam, fraud, or
inappropriate conduct. We commit to give our best output and to dedicate ourselves as much as we can
to satisfy the Client.

Both parties believe we will not offend each other, and will manage the relationship with respect
throughout the whole service process — Inshallah.

A typed full name on this letter is the Client’s digital signature and acknowledgement.
`.trim();

/** Always use OTHER + dealTag (≤50 chars) for business/service engagements */
export const DEAL_TYPE_LABELS = {
  BUY_PRODUCT: "Digital product",
  LEARN_SKILLS: "Skills / collaboration",
  OTHER: "Services engagement",
} as const;
