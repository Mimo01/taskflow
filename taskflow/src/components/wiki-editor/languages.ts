/**
 * Jira code-macro languages the wiki parser models (`^\{code:([a-z]+)\}$`).
 * code-block.test.ts proves every value against parseWiki; anything the parser does not
 * model is dropped here rather than special-cased.
 */
export const CODE_LANGUAGES: readonly { value: string; label: string }[] = [
  { value: 'actionscript', label: 'ActionScript' },
  { value: 'applescript', label: 'AppleScript' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'coldfusion', label: 'ColdFusion' },
  { value: 'css', label: 'CSS' },
  { value: 'delphi', label: 'Delphi' },
  { value: 'diff', label: 'Diff' },
  { value: 'erlang', label: 'Erlang' },
  { value: 'go', label: 'Go' },
  { value: 'groovy', label: 'Groovy' },
  { value: 'html', label: 'HTML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'perl', label: 'Perl' },
  { value: 'php', label: 'PHP' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'sass', label: 'Sass' },
  { value: 'scala', label: 'Scala' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'vb', label: 'Visual Basic' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
];
