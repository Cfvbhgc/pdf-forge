/**
 * @file templateEngine.js — HTML template loading and variable substitution
 *
 * This service is responsible for:
 *   1. Reading HTML template files from disk.
 *   2. Replacing `{{variable}}` placeholders with actual data values.
 *   3. Providing metadata about each built-in template (required fields,
 *      descriptions, and sample data for previews).
 *
 * The substitution uses a simple regex-based approach rather than a full
 * templating engine (Handlebars, EJS, etc.) to keep the dependency footprint
 * small.  The trade-off is that we don't support conditionals or loops inside
 * the template markup itself — instead, repeating sections (like invoice line
 * items) are pre-rendered in JavaScript and injected as an HTML string.
 *
 * @module services/templateEngine
 */

'use strict';

/* -------------------------------------------------------------------------- */
/*  Dependencies                                                              */
/* -------------------------------------------------------------------------- */

const fs   = require('fs');
const path = require('path');

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Absolute path to the directory that holds the built-in HTML templates.
 * Using `path.join` ensures cross-platform compatibility (Windows vs POSIX).
 *
 * @constant {string}
 */
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/* -------------------------------------------------------------------------- */
/*  Template metadata registry                                                */
/* -------------------------------------------------------------------------- */

/**
 * Registry of every built-in template.
 *
 * Each entry describes the template's purpose, the fields it expects, and a
 * `sampleData` object that can be used for the HTML preview endpoint.  Adding
 * a new template is as simple as:
 *   1. Drop an HTML file into src/templates/
 *   2. Add a corresponding entry here.
 *
 * @type {Object<string, TemplateMetadata>}
 */
const TEMPLATE_REGISTRY = {

  /* ---------------------------------------------------------------------- */
  /*  Invoice template                                                      */
  /* ---------------------------------------------------------------------- */
  invoice: {
    name: 'invoice',
    description: 'Professional invoice with itemised line items, tax calculation, and payment details.',
    requiredFields: [
      'companyName',
      'clientName',
      'items',   // Array of { name, qty, price }
      'tax',     // Tax percentage (e.g. 10 for 10 %)
      'dueDate',
    ],
    sampleData: {
      companyName: 'Acme Corp',
      companyAddress: '123 Business Ave, Suite 100, San Francisco, CA 94102',
      companyEmail: 'billing@acmecorp.com',
      companyPhone: '+1 (555) 123-4567',
      invoiceNumber: 'INV-2026-0042',
      clientName: 'Jane Smith',
      clientAddress: '456 Client Rd, New York, NY 10001',
      clientEmail: 'jane.smith@example.com',
      items: [
        { name: 'Web Design',       qty: 1, price: 2500 },
        { name: 'Frontend Dev',     qty: 40, price: 150  },
        { name: 'Backend Dev',      qty: 30, price: 175  },
        { name: 'QA & Testing',     qty: 10, price: 100  },
      ],
      tax: 10,
      dueDate: '2026-04-30',
      notes: 'Payment is due within 30 days. Thank you for your business!',
    },
  },

  /* ---------------------------------------------------------------------- */
  /*  Report template                                                       */
  /* ---------------------------------------------------------------------- */
  report: {
    name: 'report',
    description: 'Multi-section business report with title page, table of contents, and summary.',
    requiredFields: [
      'title',
      'author',
      'date',
      'sections', // Array of { heading, content }
      'summary',
    ],
    sampleData: {
      title: 'Q1 2026 Performance Report',
      author: 'Analytics Team',
      date: '2026-03-29',
      sections: [
        {
          heading: 'Revenue Overview',
          content: 'Total revenue for Q1 2026 reached $4.2 million, representing a 15% increase over Q4 2025. The growth was primarily driven by expansion in the enterprise segment, which saw a 22% increase in new contracts. Monthly recurring revenue (MRR) crossed the $1.4 million mark for the first time, indicating strong customer retention and upsell performance.',
        },
        {
          heading: 'Customer Acquisition',
          content: 'We onboarded 128 new customers during Q1, up from 97 in the previous quarter. Customer acquisition cost (CAC) decreased by 8% thanks to improved targeting in our digital campaigns. The sales team closed 15 enterprise deals, each valued at over $50,000 annually.',
        },
        {
          heading: 'Product Development',
          content: 'The engineering team shipped 3 major features and resolved 47 bugs. The new API v2 endpoint saw rapid adoption with 60% of active integrations migrating within the first month. System uptime remained at 99.97%, exceeding our SLA commitment of 99.9%.',
        },
        {
          heading: 'Outlook for Q2',
          content: 'We project continued growth of 12-18% in Q2, supported by the upcoming product launch and the expansion of our sales team into the European market. Key risks include increased competition in the mid-market segment and potential supply chain delays for hardware components.',
        },
      ],
      summary: 'Q1 2026 was a strong quarter across all key metrics. Revenue, customer acquisition, and product development all exceeded targets. The team is well-positioned for continued growth in Q2.',
    },
  },

  /* ---------------------------------------------------------------------- */
  /*  Resume template                                                       */
  /* ---------------------------------------------------------------------- */
  resume: {
    name: 'resume',
    description: 'Clean, modern resume/CV layout with sections for experience, skills, and education.',
    requiredFields: [
      'name',
      'email',
      'phone',
      'summary',
      'experience',  // Array of { company, role, period, description }
      'skills',      // Array of strings
      'education',   // Array of { school, degree, year }
    ],
    sampleData: {
      name: 'Alex Johnson',
      email: 'alex.johnson@example.com',
      phone: '+1 (555) 987-6543',
      location: 'Austin, TX',
      website: 'https://alexjohnson.dev',
      summary: 'Full-stack software engineer with 8+ years of experience building scalable web applications. Passionate about clean architecture, developer experience, and turning complex business requirements into elegant technical solutions.',
      experience: [
        {
          company: 'TechVision Inc.',
          role: 'Senior Software Engineer',
          period: '2022 - Present',
          description: 'Led the re-architecture of the core platform from a monolith to microservices, reducing deploy times by 70%. Mentored a team of 5 junior developers and established code review practices that cut production bugs by 40%.',
        },
        {
          company: 'DataFlow Systems',
          role: 'Software Engineer',
          period: '2019 - 2022',
          description: 'Built real-time data pipelines processing 2M+ events/day using Node.js and Kafka. Designed and implemented a RESTful API layer serving 50+ internal and external consumers with 99.95% uptime.',
        },
        {
          company: 'WebCraft Agency',
          role: 'Junior Developer',
          period: '2017 - 2019',
          description: 'Developed responsive web applications for 20+ clients using React and Express. Introduced automated testing practices that improved release confidence and reduced regression bugs by 60%.',
        },
      ],
      skills: [
        'JavaScript / TypeScript',
        'Node.js / Express',
        'React / Next.js',
        'PostgreSQL / MongoDB',
        'Docker / Kubernetes',
        'AWS / GCP',
        'CI/CD (GitHub Actions)',
        'REST & GraphQL APIs',
      ],
      education: [
        {
          school: 'University of Texas at Austin',
          degree: 'B.S. Computer Science',
          year: '2017',
        },
      ],
    },
  },

  /* ---------------------------------------------------------------------- */
  /*  Certificate template                                                  */
  /* ---------------------------------------------------------------------- */
  certificate: {
    name: 'certificate',
    description: 'Elegant certificate of completion suitable for courses, workshops, and achievements.',
    requiredFields: [
      'recipientName',
      'courseName',
      'date',
      'issuer',
      'description',
    ],
    sampleData: {
      recipientName: 'Maria Gonzalez',
      courseName: 'Advanced Cloud Architecture',
      date: '2026-03-15',
      issuer: 'TechAcademy Global',
      issuerTitle: 'Director of Education',
      description: 'Has successfully completed the 12-week intensive program covering distributed systems design, cloud-native development patterns, infrastructure as code, and production reliability engineering.',
      certificateId: 'CERT-2026-ACA-00731',
    },
  },
};

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Return a list of all available template names.
 *
 * This is used by the GET /api/templates endpoint to let consumers discover
 * which templates are supported without having to guess.
 *
 * @returns {string[]} Array of template name strings, e.g. ["invoice", "report", ...].
 */
function listTemplates() {
  return Object.keys(TEMPLATE_REGISTRY);
}

/**
 * Return full metadata for every registered template.
 *
 * The returned array is useful for documentation endpoints — it includes the
 * template name, a human-readable description, required field names, and
 * sample data.
 *
 * @returns {TemplateMetadata[]} Array of metadata objects.
 */
function getTemplatesMetadata() {
  return Object.values(TEMPLATE_REGISTRY).map((tpl) => ({
    name: tpl.name,
    description: tpl.description,
    requiredFields: tpl.requiredFields,
    sampleData: tpl.sampleData,
  }));
}

/**
 * Return metadata for a single template by name.
 *
 * @param {string} name — The template identifier (e.g. "invoice").
 * @returns {TemplateMetadata|null} The metadata object, or null if not found.
 */
function getTemplateMetadata(name) {
  return TEMPLATE_REGISTRY[name] || null;
}

/**
 * Read a raw HTML template from disk.
 *
 * The file is read synchronously because templates are small and this
 * simplifies the calling code.  In a high-throughput scenario you could
 * add an in-memory cache here.
 *
 * @param {string} name — Template identifier (must match a filename without extension).
 * @returns {string} The raw HTML content of the template.
 * @throws {Error} If the template file does not exist on disk.
 */
function loadTemplate(name) {
  const filePath = path.join(TEMPLATES_DIR, `${name}.html`);

  /*
   * Verify the file exists before attempting to read it.
   * This gives us a more descriptive error message than the default
   * ENOENT from fs.readFileSync.
   */
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template "${name}" not found at ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Render a template by substituting `{{key}}` placeholders with values from
 * the provided data object.
 *
 * Substitution rules:
 *   - Simple values (strings, numbers) replace `{{key}}` directly.
 *   - Arrays of objects are pre-rendered into HTML fragments (e.g. table rows
 *     for invoice items) by dedicated helper functions before insertion.
 *   - Nested access (e.g. `{{foo.bar}}`) is NOT supported — keep data flat
 *     or pre-process complex structures in the helpers below.
 *
 * @param {string} templateName — Which template to load (e.g. "invoice").
 * @param {Object} data — Key-value pairs to inject into the template.
 * @returns {string} Fully rendered HTML string ready for Puppeteer.
 *
 * @example
 *   const html = renderTemplate('certificate', {
 *     recipientName: 'Alice',
 *     courseName: 'Node.js Mastery',
 *     date: '2026-01-15',
 *     issuer: 'Code Academy',
 *     description: 'Completed the 8-week programme.',
 *   });
 */
function renderTemplate(templateName, data) {
  /* Step 1 — Load the raw HTML from disk. */
  let html = loadTemplate(templateName);

  /*
   * Step 2 — Pre-process complex/array fields into HTML fragments.
   *
   * Each template may have array fields that need to be turned into
   * repeated HTML (e.g. <tr> rows for invoice items).  We handle this
   * with template-specific helper functions that return an HTML string.
   * The result is stored back into `data` so the generic regex
   * replacement in Step 3 can insert it.
   */
  const processed = preprocessData(templateName, { ...data });

  /*
   * Step 3 — Generic placeholder replacement.
   *
   * The regex matches any {{key}} token.  For each match we look up
   * the key in our processed data object.  If the value is undefined
   * we leave the placeholder as-is (which helps with debugging).
   */
  html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (processed[key] !== undefined && processed[key] !== null) {
      return String(processed[key]);
    }
    /* Return empty string for missing optional fields. */
    return '';
  });

  return html;
}

/* -------------------------------------------------------------------------- */
/*  Data pre-processing helpers                                               */
/* -------------------------------------------------------------------------- */

/**
 * Pre-process the raw data object for a specific template.
 *
 * This function dispatches to template-specific helpers that convert
 * complex data (arrays of objects, computed values) into flat HTML
 * strings that can be injected via simple `{{key}}` replacement.
 *
 * @param {string} templateName — The template being rendered.
 * @param {Object} data — Mutable copy of the caller's data object.
 * @returns {Object} The same data object, enriched with computed HTML fields.
 */
function preprocessData(templateName, data) {
  switch (templateName) {
    case 'invoice':
      return preprocessInvoice(data);
    case 'report':
      return preprocessReport(data);
    case 'resume':
      return preprocessResume(data);
    case 'certificate':
      /* Certificates have no complex fields — return as-is. */
      return data;
    default:
      return data;
  }
}

/**
 * Pre-process invoice data.
 *
 * Converts the `items` array into an HTML table-rows string and computes
 * subtotal, tax amount, and grand total.
 *
 * @param {Object} data — Invoice data with an `items` array.
 * @returns {Object} Enriched data with `itemsHtml`, `subtotal`, `taxAmount`, `total`.
 */
function preprocessInvoice(data) {
  const items = data.items || [];
  const taxRate = parseFloat(data.tax) || 0;

  /*
   * Build one <tr> per line item.
   * Each row has: item name, quantity, unit price, line total.
   */
  let subtotal = 0;
  const rows = items.map((item, index) => {
    const lineTotal = (item.qty || 0) * (item.price || 0);
    subtotal += lineTotal;
    return `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">${item.name || ''}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty || 0}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.price || 0).toFixed(2)}</td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${lineTotal.toFixed(2)}</td>
      </tr>`;
  });

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  data.itemsHtml = rows.join('\n');
  data.subtotal  = subtotal.toFixed(2);
  data.taxAmount = taxAmount.toFixed(2);
  data.total     = total.toFixed(2);

  return data;
}

/**
 * Pre-process report data.
 *
 * Converts the `sections` array into HTML blocks, each with a heading and
 * paragraph content.
 *
 * @param {Object} data — Report data with a `sections` array.
 * @returns {Object} Enriched data with `sectionsHtml`.
 */
function preprocessReport(data) {
  const sections = data.sections || [];

  const blocks = sections.map((section, index) => `
    <div style="margin-bottom: 28px;">
      <h2 style="font-size: 20px; color: #1e293b; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;">
        ${index + 1}. ${section.heading || ''}
      </h2>
      <p style="font-size: 14px; line-height: 1.7; color: #334155; text-align: justify;">
        ${section.content || ''}
      </p>
    </div>`);

  data.sectionsHtml = blocks.join('\n');

  return data;
}

/**
 * Pre-process resume data.
 *
 * Converts `experience`, `skills`, and `education` arrays into HTML fragments.
 *
 * @param {Object} data — Resume data.
 * @returns {Object} Enriched data with `experienceHtml`, `skillsHtml`, `educationHtml`.
 */
function preprocessResume(data) {
  /* --- Experience entries --- */
  const experience = data.experience || [];
  const expBlocks = experience.map((exp) => `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <h3 style="font-size: 16px; font-weight: 700; color: #1e293b; margin: 0;">${exp.role || ''}</h3>
        <span style="font-size: 13px; color: #64748b; white-space: nowrap;">${exp.period || ''}</span>
      </div>
      <div style="font-size: 14px; color: #6366f1; font-weight: 600; margin-bottom: 6px;">${exp.company || ''}</div>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">${exp.description || ''}</p>
    </div>`);
  data.experienceHtml = expBlocks.join('\n');

  /* --- Skills list — rendered as inline "chips" --- */
  const skills = data.skills || [];
  const skillChips = skills.map(
    (s) => `<span style="display: inline-block; background: #eef2ff; color: #4338ca; padding: 5px 14px; border-radius: 20px; font-size: 13px; margin: 4px 4px 4px 0; font-weight: 500;">${s}</span>`
  );
  data.skillsHtml = skillChips.join('\n');

  /* --- Education entries --- */
  const education = data.education || [];
  const eduBlocks = education.map((edu) => `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline;">
        <strong style="font-size: 15px; color: #1e293b;">${edu.degree || ''}</strong>
        <span style="font-size: 13px; color: #64748b;">${edu.year || ''}</span>
      </div>
      <div style="font-size: 14px; color: #6366f1;">${edu.school || ''}</div>
    </div>`);
  data.educationHtml = eduBlocks.join('\n');

  return data;
}

/* -------------------------------------------------------------------------- */
/*  JSDoc type definitions (for editor IntelliSense)                          */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} TemplateMetadata
 * @property {string}   name           — Unique identifier for the template.
 * @property {string}   description    — Human-readable description.
 * @property {string[]} requiredFields — List of top-level field names the template expects.
 * @property {Object}   sampleData     — Example payload for previews.
 */

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

module.exports = {
  listTemplates,
  getTemplatesMetadata,
  getTemplateMetadata,
  loadTemplate,
  renderTemplate,
};
