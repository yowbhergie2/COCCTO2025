// HistoryFormService.gs - Generate HistoryForm HTML with pre-populated years

/**
 * Get the HistoryForm HTML with years already populated
 * @returns {string} HTML content with year options
 */
function getHistoryFormHTML() {
  // Generate year options server-side
  const startYear = 2024;
  const currentYear = new Date().getFullYear();

  let yearOptions = '<option value="">-- Select Year --</option>';
  for (let i = currentYear; i >= startYear; i--) {
    yearOptions += '<option value="' + i + '">' + i + '</option>';
  }

  // Read the base template
  const template = HtmlService.createTemplateFromFile('HistoryForm');

  // Inject the year options
  template.yearOptions = yearOptions;

  return template.evaluate().getContent();
}
