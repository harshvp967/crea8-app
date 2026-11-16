const UPDATED = 'November 16, 2026';

function link(href, label) {
  const external = href.startsWith('http') || href.startsWith('mailto:');
  const rel = external ? ' rel="noopener noreferrer"' : '';
  return `<a href="${href}"${rel}>${label}</a>`;
}

function operator() {
  return `<p>crea8.one is operated by Harsh Verma (Zero Print Plus).</p>
    <address class="operator">
      Harsh Verma, sole proprietor, trading as Zero Print Plus<br>
      Greater Noida, Uttar Pradesh, India<br>
      Privacy: ${link('mailto:privacy@crea8.one', 'privacy@crea8.one')}<br>
      Legal: ${link('mailto:legal@crea8.one', 'legal@crea8.one')}<br>
      Support: ${link('mailto:support@crea8.one', 'support@crea8.one')}<br>
      Grievance Officer (India DPDP Act 2023 and the IT Rules): Harsh Verma, ${link('mailto:support@crea8.one', 'support@crea8.one')}
    </address>`;
}

function legalNav() {
  return `<nav class="legal-nav" aria-label="Legal documents">
      ${link('/privacy', 'Privacy')}
      ${link('/terms', 'Terms')}
      ${link('/data-deletion', 'Data deletion')}
      ${link('/refund-policy', 'Refunds')}
    </nav>`;
}

function shell(title, updated, body) {
  const date = updated ? `<p class="updated">Last updated: ${updated}</p>` : '';
  return `<article class="legal">
      <h1>${title}</h1>
      ${date}
      ${operator()}
      ${body}
      ${legalNav()}
    </article>`;
}

const linkCapture = `<h2>Link in Bio email capture</h2>
    <p>A public Link in Bio page can include an email-capture block. We store an email address submitted on that block, a name if that page asks for one, and the country code and referrer sent with the submission. We store the submission for the organization that owns the page. That organization can view and export it.</p>
    <p>If the page asks the person to confirm, we email a confirmation link and the address stays pending until they confirm. If the organization turned on subscriber notifications, we email the address to a member of that organization. If the organization connected Mailchimp, ConvertKit, or a webhook, we send the address to that connection. We do not send it to those services when they are not connected.</p>
    <p>The workspace owner can delete a stored address in Link in Bio. A person who submitted an address can email ${link('mailto:support@crea8.one', 'support@crea8.one')} and ask for deletion.</p>`;

export const privacy = shell(
  'Privacy Policy',
  UPDATED,
  `<p>This policy explains how crea8.one handles personal information for the whole product: Schedule, Link in Bio, Stalker, AI drafts, MCP, and the CLI and other agents you connect. You connect your own social accounts, schedule and publish posts, host a public link page, and can read mentions of a brand you choose.</p>
    <p>crea8.one is offered to people in India, the United States, the European Union, the United Kingdom, and the rest of the world.</p>
    <h2>Information we process</h2>
    <ul>
      <li>Account information, such as your name and email address.</li>
      <li>Connected-platform OAuth tokens, and profile or page information for the accounts you choose to connect.</li>
      <li>API keys you create for MCP, an agent, or the CLI.</li>
      <li>Content you upload, draft, or schedule, including AI drafts you ask for.</li>
      <li>Mentions Stalker stores for a project you set up, and comments on accounts you connect.</li>
      <li>Usage and log data, such as IP address, browser type, device information, and timestamps, used to run and protect the service.</li>
      <li>Essential cookies that keep you signed in and remember basic preferences, and analytics cookies that help us understand how the service is used.</li>
      <li>Payment information is handled by Dodo Payments, the merchant of record. We do not store your card number or full payment card details. Dodo Payments shares limited billing details with us, such as plan and subscription status. GST is added at checkout. The 7-day trial checks out at $0. You can cancel anytime from billing.</li>
      <li>An email address submitted on a public Link in Bio email-capture block, a name if that page asks for one, and the country code and referrer sent with the submission.</li>
    </ul>
    ${linkCapture}
    <h2>How we use information</h2>
    <p>We use personal information to provide, maintain, and secure the service you request. That includes connecting the accounts you authorize, publishing what you ask us to publish, hosting your Link in Bio page, preparing Stalker mentions and AI drafts, and answering an agent you connect with your own key or OAuth grant. We also use it to provide support, bill subscriptions through the merchant of record, and meet legal duties.</p>
    <p>We use data from connected platforms only to provide the service. We do not sell that data, and we do not use it to train crea8.one models.</p>
    <h2>Connected platforms</h2>
    <h3>YouTube and Google</h3>
    <p>If you connect YouTube, crea8.one's use of information received from Google APIs complies with the ${link('https://developers.google.com/terms/api-services-user-data-policy', 'Google API Services User Data Policy')}, including the Limited Use requirements.</p>
    <p>YouTube features you use through crea8.one are also covered by the ${link('https://www.youtube.com/t/terms', 'YouTube Terms of Service')} and the ${link('https://policies.google.com/privacy', 'Google Privacy Policy')}. You can revoke crea8.one's access to your Google account at any time at ${link('https://security.google.com/settings/security/permissions', 'https://security.google.com/settings/security/permissions')}.</p>
    <h3>Meta (Facebook, Instagram, and Threads)</h3>
    <p>If you connect Facebook, Instagram, or Threads, we use the data Meta provides only to provide crea8.one to you, including scheduling, publishing, and insights on accounts you connect. We do not sell this data, and we do not use it to train crea8.one models. How to ask us to delete it is described on the ${link('/data-deletion', 'Data deletion')} page. You can also remove crea8.one from Facebook under Settings, Apps and Websites.</p>
    <h3>TikTok, Pinterest, X, and LinkedIn</h3>
    <p>Data from TikTok, Pinterest, X, and LinkedIn is used only to provide the service. It is never sold and never used to train crea8.one models.</p>
    <h3>Reddit</h3>
    <p>If you connect Reddit, you do so through OAuth. The scopes are identity, read, submit, and flair. We store the tokens so we can post, on your behalf, to the subreddits you choose. Disconnecting Reddit removes that access.</p>
    <p>Mention monitoring is separate from publishing. When you set a brand or keywords, we retrieve public Reddit posts and comments that match them through Reddit's API. For each match we store the permalink, the author's username, the text (up to 2,000 characters), the score, and the comment count. We send that mention text to OpenAI only to label category, sentiment, and urgency, and to summarize topics, for that customer.</p>
    <p>We do not sell or license Reddit data, and we do not share it except with the AI provider named above, which receives mention text only for that labeling and summarization. We do not use Reddit data for ad targeting. We do not train or fine-tune AI models on Reddit data. We do not profile individual Redditors. Mention history follows the plan you are on: 30, 90, or 365 days. Stored mentions link back to Reddit.</p>
    <p>These Reddit features follow Reddit's ${link('https://redditinc.com/policies/user-agreement', 'User Agreement')}, ${link('https://redditinc.com/policies/developer-terms', 'Developer Terms')}, ${link('https://redditinc.com/policies/data-api-terms', 'Data API Terms')}, and ${link('https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy', 'Responsible Builder Policy')}. To ask us to remove Reddit data, email ${link('mailto:support@crea8.one', 'support@crea8.one')}.</p>
    <h2>India (DPDP Act 2023)</h2>
    <p>Where India's Digital Personal Data Protection Act, 2023 applies, we process personal data for lawful purposes, including providing the service you request, meeting legal duties, and, where the law requires it, with your consent. You may ask to access, correct, or erase your personal data, and you may nominate another person to exercise your rights, by emailing ${link('mailto:support@crea8.one', 'support@crea8.one')}. Where processing is based on consent, you may withdraw that consent. You may contact the Grievance Officer named above, and you may complain to the Data Protection Board of India.</p>
    <h2>European Union and United Kingdom</h2>
    <p>Where the GDPR or UK GDPR applies, we rely on these lawful bases:</p>
    <ul>
      <li>Contract: to provide the account, scheduling, publishing, Link in Bio, Stalker, and the agent access you sign up for.</li>
      <li>Legitimate interests: to keep the service secure, prevent abuse, and understand how it is used, where those interests are not overridden by your rights.</li>
      <li>Consent: for analytics cookies where consent is required, and for any other processing that needs consent. You can withdraw consent at any time.</li>
      <li>Legal obligation: where the law requires us to keep or share information.</li>
    </ul>
    <p>You can ask for access, correction, erasure, restriction, or a copy of your personal data, and you can object to processing based on legitimate interests. AI drafts and Stalker labels are prepared for you to review. They are not decisions that produce legal effects about you. You may lodge a complaint with your local supervisory authority, or with the UK Information Commissioner's Office if you are in the United Kingdom.</p>
    <p>We are based in India. Service providers may process personal data in other countries, including the United States. Where the GDPR or UK GDPR requires a transfer tool, we use Standard Contractual Clauses (and the UK Addendum or the International Data Transfer Agreement where UK GDPR applies).</p>
    <h2>California (CCPA / CPRA)</h2>
    <p>This section applies to California residents.</p>
    <p>Categories of personal information we collect:</p>
    <ul>
      <li>Identifiers, such as name, email address, and account ID.</li>
      <li>Commercial information, such as subscription status received from the merchant of record.</li>
      <li>Internet or network activity, such as usage and log data.</li>
      <li>Information you choose to give us about a business or organization.</li>
      <li>Content you upload, and mentions or insights drawn from accounts you connect.</li>
    </ul>
    <p>We do not sell or share personal information. We do not sell or share personal information of anyone under 16.</p>
    <p>You have the right to know, delete, and correct personal information, and the right to opt out of sale or sharing. You will not receive discriminatory treatment for exercising these rights. Email ${link('mailto:support@crea8.one', 'support@crea8.one')} with the subject "California privacy request". We will verify the request using the email address on your account. An authorized agent may submit a request for you. We may ask for proof that you authorized the agent.</p>
    <h2>Cookies</h2>
    <p>Essential cookies keep you signed in and remember basic preferences, including the light or dark theme on this site. Analytics cookies help us see which parts of the service are used. You can control cookies in your browser. Blocking essential cookies may stop the service from working.</p>
    <h2>Processors</h2>
    <ul>
      <li>Cloudflare, for this site and for file storage when storage is set to Cloudflare.</li>
      <li>Railway, for the API and background jobs.</li>
      <li>Vercel, for the signed-in app.</li>
      <li>Resend, for email when email is set to Resend.</li>
      <li>Dodo Payments, the merchant of record and payment processor.</li>
      <li>OpenAI, for AI drafts and for Stalker labeling and summaries when an API key is configured.</li>
      <li>The social platforms you connect, through their APIs.</li>
    </ul>
    <p>Content processed by AI features, for example Stalker mention classification and AI drafts, is sent to OpenAI when an API key is configured. OpenAI may use that content to improve and train its models. Avoid putting sensitive personal data into AI features. Questions can be sent to ${link('mailto:support@crea8.one', 'support@crea8.one')}.</p>
    <p>These providers must protect personal information. They may use it only to perform services for us, except for the OpenAI training use described above.</p>
    <h2>How long we keep information</h2>
    <p>We keep account and content data while your account is open. After you delete your account, or after we verify a deletion request, we delete or de-identify personal information within 30 days, except where we must keep it longer for legal, security, or accounting reasons. Backups may retain copies for up to 90 days. The merchant of record may keep payment records as tax and accounting law requires. See ${link('/data-deletion', 'Data deletion')} for how to ask.</p>
    <p>Stalker mention history follows the plan: 30 days on Creator, 90 days on Team, and 365 days on Pro and Agency.</p>
    <h2>Security</h2>
    <p>We use access controls and encrypted connections that fit the service. No method of storage or transmission is completely secure.</p>
    <h2>Children</h2>
    <p>crea8.one is not directed at children under 18, and we do not knowingly collect personal information from children.</p>
    <h2>Changes</h2>
    <p>We may update this policy. The "Last updated" date at the top will change. If a change materially affects how we use personal information, we will post the update on this page.</p>
    <h2>Contact</h2>
    <p>Email ${link('mailto:privacy@crea8.one', 'privacy@crea8.one')}, ${link('mailto:legal@crea8.one', 'legal@crea8.one')}, or ${link('mailto:support@crea8.one', 'support@crea8.one')}. The ${link('/terms', 'Terms of Service')} explain the rules for using crea8.one.</p>`
);

export const terms = shell(
  'Terms of Service',
  UPDATED,
  `<p>These Terms of Service are a contract between you and Harsh Verma, a sole proprietor trading as Zero Print Plus ("we", "us"), for crea8.one.</p>
    <p>crea8.one is Schedule, Link in Bio, Stalker, AI drafts, MCP, and the CLI and other agents you connect. You connect your own social accounts, schedule and publish posts, host a public link page, and can read mentions of a brand you choose.</p>
    <h2>Using crea8.one</h2>
    <p>You need an account, and the information you give us must be accurate. You are responsible for activity under your account, for keys you create, and for keeping your login secure. Connecting a social account lets us access that account as the platform allows, so we can provide scheduling, publishing, Link in Bio, and Stalker for accounts you connect.</p>
    <h2>Acceptable use</h2>
    <p>Do not use crea8.one to send spam, to publish unlawful or infringing content, or to break the rules of a platform you connect. You are responsible for following each platform's terms. We may suspend or end access if you misuse the service or create risk for us, for other people, or for a platform.</p>
    <h2>Your content</h2>
    <p>You own the content you upload, schedule, and publish. You grant us a limited, worldwide, non-exclusive license to host, store, reproduce, format, display, and transmit that content only to provide, secure, and support the service. That includes publishing it to the accounts you select, showing it on your Link in Bio page, and preparing drafts or mentions you request. The license ends when the content is deleted from our systems, except for backup copies kept for up to 90 days, and except for content already published on a third-party platform, which stays subject to that platform's terms.</p>
    <h2>AI drafts</h2>
    <p>Drafts and Stalker labels may be produced by a third-party model. Output can be wrong, incomplete, or unsuitable. You are responsible for reviewing anything before you publish it, send it, or rely on it. We do not use your content or connected-account data to train crea8.one models. Data from TikTok, Pinterest, X, and LinkedIn is used only to provide the service, is never sold, and is never used to train crea8.one models. Reddit mention text may be sent to OpenAI only to label category, sentiment, and urgency and to summarize topics for the customer who set the keywords. We do not train or fine-tune AI models on Reddit data. YouTube data is used in line with the Google API Services User Data Policy, including Limited Use.</p>
    <h2>Agents</h2>
    <p>MCP and the CLI act as you, using an API key you create or an OAuth grant you approve. You are responsible for what an agent does with that access. A custom connector, an API key, or the CLI is how you connect. A key in a chat or a config file is your credential. Revoke a key you no longer want used.</p>
    <h2>Third-party platforms</h2>
    <p>Social platforms are run by third parties. Their availability, APIs, and rules can change or stop. We do not control those platforms, and a platform may reject a post, change an API, or disconnect an account. If you connect YouTube, the ${link('https://www.youtube.com/t/terms', 'YouTube Terms of Service')} also apply. Google's privacy practices are described in the ${link('https://policies.google.com/privacy', 'Google Privacy Policy')}. You can revoke Google access at ${link('https://security.google.com/settings/security/permissions', 'https://security.google.com/settings/security/permissions')}.</p>
    <p>Reddit features are subject to Reddit's terms. You must not use crea8.one to post identical or substantially similar content across subreddits, or to spam.</p>
    <h2>Subscriptions, billing, and refunds</h2>
    <p>Paid plans are billed by Dodo Payments, which acts as the merchant of record and payment processor. Dodo Payments is the seller of record for the payment, invoice, and applicable taxes. We do not store your card number. Prices are USD. GST is added at checkout. The price, billing period, and what a plan includes are shown at checkout.</p>
    <p>The 7-day trial checks out at $0 and includes 50 credits. You are not charged today. The plan's monthly credits apply on the first successful charge. You can cancel anytime from billing. Cancellation stops later charges. It does not, by itself, refund a period that has already started, unless a refund is required by law or granted by the merchant. Credit packs are 150 credits for $5 and 500 credits for $15, also charged by Dodo Payments in USD, with GST added at checkout.</p>
    <p>Refunds are handled by the merchant of record under its terms and under any mandatory consumer law that applies to you. See ${link('/refund-policy', 'Refunds')}.</p>
    <h2>Link in Bio email capture</h2>
    <p>If you add an email-capture block to your public Link in Bio page, we store each submitted email address for your organization, with a name when you ask for one, and the country code and referrer sent with the submission. Your organization can view and export those addresses. The workspace owner can delete one in Link in Bio. If the page asks the person to confirm, the address stays pending until they confirm. If you turned on subscriber notifications, we email the address to a member. If you connected Mailchimp, ConvertKit, or a webhook, we send the address there too. When a person asks you to delete an address, the workspace owner deletes it in Link in Bio.</p>
    <h2>Privacy and deletion</h2>
    <p>The ${link('/privacy', 'Privacy Policy')} explains how we handle personal information. The ${link('/data-deletion', 'Data deletion')} page explains how to ask us to delete it. There is no separate deletion API on this site.</p>
    <h2>Disclaimers</h2>
    <p>The service is provided "as is" and "as available". To the extent the law allows, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that a post will publish on time, that a platform will accept it, or that an AI draft will be accurate.</p>
    <h2>Liability</h2>
    <p>To the extent the law allows, our total liability arising out of the service in any 12-month period is limited to the amount you paid for crea8.one in that period. We are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost data, or lost goodwill.</p>
    <p>Nothing in these terms limits liability that cannot be limited under the law, including liability for fraud, or for death or personal injury caused by negligence where a limit is prohibited. Mandatory consumer protections of your country stay in force.</p>
    <h2>Termination</h2>
    <p>You may stop using crea8.one at any time and ask us to delete your account, as described on the ${link('/data-deletion', 'Data deletion')} page. We may suspend or end access if you break these terms, if the law or a platform requires it, or if we discontinue the service. When access ends, your license to use the service ends. Sections that should survive, including content ownership, disclaimers, liability, and governing law, continue to apply.</p>
    <h2>Source code</h2>
    <p>crea8.one is based on software available under the GNU Affero General Public License. Source code is available at ${link('https://github.com/harshvp967/crea8-app', 'https://github.com/harshvp967/crea8-app')}. These terms govern use of the hosted service. The AGPL governs the source code, as that license states.</p>
    <h2>Changes to these terms</h2>
    <p>We may update these terms. The "Last updated" date will change, and we will post the new terms on this page. If you keep using crea8.one after the update applies, the new terms apply. If you do not agree, stop using the service and ask us to delete your account.</p>
    <h2>Governing law</h2>
    <p>These terms are governed by the laws of India. Subject to mandatory rights you have to bring a claim in your country of residence, the courts at Gautam Buddha Nagar, Noida, India, have jurisdiction. Mandatory consumer protections of the country where you live still apply.</p>
    <h2>Contact</h2>
    <p>Email ${link('mailto:legal@crea8.one', 'legal@crea8.one')} or ${link('mailto:support@crea8.one', 'support@crea8.one')}.</p>`
);

export const dataDeletion = shell(
  'Data deletion',
  UPDATED,
  `<p>This page is the data deletion instructions for crea8.one. It covers Schedule, Link in Bio, Stalker, AI drafts, MCP, and the agents you connect. It applies to every crea8.one account, including people who connected Facebook, Instagram, or Threads.</p>
    <p>This page does not add a deletion API. Use the in-product controls below, or email ${link('mailto:support@crea8.one?subject=Data%20Deletion%20Request', 'support@crea8.one')}.</p>
    <h2>Disconnect a channel</h2>
    <p>Disconnecting a channel in the product removes that connection, including the OAuth tokens stored for it. Content already published on the social platform stays on that platform until you delete it there.</p>
    <h2>Delete your account</h2>
    <p>You can delete your account from account settings in the product. The control is Delete Account. Deleting the account removes the crea8.one account and the organizations, channels, posts, and related records we store for it. This action cannot be undone.</p>
    <p>You can also email ${link('mailto:support@crea8.one?subject=Data%20Deletion%20Request', 'support@crea8.one')} with the subject "Data Deletion Request". Send the email from the address on the account, and say whether you want one channel removed or the whole account deleted. We may ask you to confirm that you control the account.</p>
    <h2>Link in Bio</h2>
    <p>The workspace owner can delete a stored email address in Link in Bio. A person who submitted an address can email ${link('mailto:support@crea8.one', 'support@crea8.one')} and ask for deletion.</p>
    <h2>Facebook, Instagram, and Threads</h2>
    <p>You can remove crea8.one from Facebook settings (Settings, Apps and Websites). That revokes Facebook's permission. To delete data we already stored, also disconnect the channel, delete your account, or email us with the subject "Data Deletion Request".</p>
    <p>You can revoke Google or YouTube access at ${link('https://security.google.com/settings/security/permissions', 'https://security.google.com/settings/security/permissions')}.</p>
    <h2>What is deleted</h2>
    <p>When we delete your account, we delete or de-identify:</p>
    <ul>
      <li>Your name, email address, and account profile.</li>
      <li>Connected-account OAuth tokens, API keys, and stored profile or page information.</li>
      <li>Content you uploaded or scheduled that we still store, including drafts.</li>
      <li>Link in Bio pages and stored email-capture submissions for your organizations.</li>
      <li>Stalker projects, keywords, and mentions we stored for your organizations.</li>
      <li>Comments and engagement we stored from your connected accounts.</li>
      <li>Usage data tied to your account, where it is reasonable to delete it.</li>
    </ul>
    <p>We do not delete:</p>
    <ul>
      <li>Content already published on a third-party platform. Delete that on the platform.</li>
      <li>Records Dodo Payments, the merchant of record and payment processor, must keep for tax, accounting, or fraud prevention. We do not store your card number.</li>
      <li>Information we must keep to comply with law, resolve a dispute, or enforce our terms.</li>
    </ul>
    <h2>Timeline</h2>
    <p>We complete deletion within 30 days of a verified request. Backups may keep a copy for up to 90 days. After that, those backup copies are overwritten.</p>
    <h2>Confirmation</h2>
    <p>When we finish deleting your account, we send a confirmation email to the address on the account, or to the address you used for the request if the account email no longer exists.</p>
    <h2>Contact</h2>
    <p>Grievance Officer: Harsh Verma, ${link('mailto:support@crea8.one', 'support@crea8.one')}.</p>
    <p>See also the ${link('/privacy', 'Privacy Policy')} and the ${link('/terms', 'Terms of Service')}.</p>`
);

export const refunds = shell(
  'Refunds',
  'November 16, 2026',
  `<p>Paid plans and credit packs are billed by Dodo Payments, the merchant of record. Prices are USD. GST is added at checkout. We do not store your card number.</p>
    <p>The 7-day trial checks out at $0 and includes 50 credits. You are not charged today. The plan's monthly credits apply on the first successful charge.</p>
    <p>You can cancel anytime from billing. Cancellation stops later charges. Access continues until the end of the period already paid, when a cancellation is scheduled. Cancellation does not, by itself, refund a period that has already started, unless a refund is required by law or granted by the merchant.</p>
    <p>Credit packs are 150 credits for $5 and 500 credits for $15. They are charged by Dodo Payments the same way as a plan.</p>
    <p>Questions about a charge can be sent to ${link('mailto:support@crea8.one', 'support@crea8.one')}. Include the email on the account and the date of the charge. Refunds are handled by the merchant of record under its terms and under any mandatory consumer law that applies to you.</p>
    <p>The ${link('/terms', 'Terms of Service')} cover subscriptions, billing, and refunds.</p>`
);
