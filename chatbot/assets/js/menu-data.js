/*
=====================================================
MARKSTREET MENU CONTENT CONFIGURATION
=====================================================

This file controls all content used by the global
MarkStreet navigation menu.

To add a new primary menu category:
1. Add a new object to window.MARKSTREET_MENU.
2. Give it a unique "id".
3. Set the visible "label".
4. Set its "type" to "primary" or "utility".
5. Set the main page "href".
6. Add an optional "description".
7. Add submenu links inside "children".

Example:

{
  id: "example",
  label: "Example",
  type: "primary",
  href: "example.html",
  description: "Short description.",
  children: [
    {
      label: "Child Link",
      href: "example.html#child"
    }
  ]
}

IMPORTANT:
Do not edit the menu HTML manually to change navigation
content. Update this file instead.

=====================================================
*/

window.MARKSTREET_MENU = [
  {
    id: "capabilities",
    label: "Capabilities",
    type: "primary",
    href: "capabilities.html",
    description: "Strategic solutions across business growth, market positioning, media direction and content performance.",
    children: [
      { label: "Business Solutions", href: "capabilities.html#business-solutions" },
      { label: "Market Strategy", href: "capabilities.html#market-strategy" },
      { label: "Brand & Communication", href: "capabilities.html#brand-communication" },
      { label: "Media Strategy", href: "capabilities.html#media-strategy" },
      { label: "Content Optimization", href: "capabilities.html#content-optimization" },
      { label: "Campaign Activation", href: "capabilities.html#campaign-activation" }
    ]
  },
  {
    id: "method",
    label: "Method",
    type: "primary",
    href: "method.html",
    description: "A structured path from diagnosis to deployment.",
    children: [
      { label: "Diagnose", href: "method.html#diagnose" },
      { label: "Define", href: "method.html#define" },
      { label: "Design", href: "method.html#design" },
      { label: "Deploy", href: "method.html#deploy" }
    ]
  },
  {
    id: "industries",
    label: "Industries",
    type: "primary",
    href: "industries.html",
    description: "Cross-sector thinking for brands moving through complex markets.",
    children: [
      { label: "Consumer Brands", href: "industries.html#consumer" },
      { label: "Technology", href: "industries.html#technology" },
      { label: "Retail", href: "industries.html#retail" },
      { label: "Real Estate", href: "industries.html#real-estate" },
      { label: "Finance", href: "industries.html#finance" }
    ]
  },
  {
    id: "engagements",
    label: "Engagements",
    type: "primary",
    href: "engagements.html",
    description: "Selected consulting work, strategic systems and market movement cases.",
    children: [
      { label: "Selected Engagements", href: "engagements.html" },
      { label: "Market Repositioning", href: "engagements.html#market-repositioning" },
      { label: "Growth Roadmap", href: "engagements.html#growth-roadmap" },
      { label: "Media Direction System", href: "engagements.html#media-direction" }
    ]
  },
  {
    id: "insights",
    label: "Insights",
    type: "primary",
    href: "insights.html",
    description: "Market notes, strategic thinking and business growth perspectives.",
    children: [
      { label: "Featured Insights", href: "insights.html" },
      { label: "Market Notes", href: "insights.html#market-notes" },
      { label: "Business Growth", href: "insights.html#business-growth" },
      { label: "Media Strategy", href: "insights.html#media-strategy" }
    ]
  },
  {
    id: "about",
    label: "About",
    type: "utility",
    href: "about.html",
    description: "An advisory firm built around business direction, market intelligence and communication systems.",
    children: [
      { label: "Company Overview", href: "about.html#overview" },
      { label: "Our Perspective", href: "about.html#perspective" },
      { label: "How We Think", href: "about.html#thinking" },
      { label: "Principles", href: "about.html#principles" }
    ]
  },
  {
    id: "contact",
    label: "Contact",
    type: "utility",
    href: "contact.html",
    description: "Start a conversation about a business challenge that needs direction.",
    children: [
      { label: "Start a Conversation", href: "contact.html" },
      { label: "Business Inquiry", href: "contact.html#business-inquiry" },
      { label: "Partnership", href: "contact.html#partnership" }
    ]
  }
];
