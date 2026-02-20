import { parseSkillFile } from './skill-file-parser.js'

// Simple test runner
function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    console.error(`✗ ${name}`)
    console.error(`  ${error}`)
    process.exitCode = 1
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    )
  }
}

// Test Suite
console.log('\n=== parseSkillFile Tests ===\n')

// Test 1: YAML frontmatter with name and description
test('YAML frontmatter: extracts name and description', () => {
  const content = `---
name: Code Review
description: Review code for best practices
---
Please review the following code carefully.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Code Review')
  assertEquals(result.description, 'Review code for best practices')
  assertEquals(result.prompt, 'Please review the following code carefully.')
})

// Test 2: YAML frontmatter with only name
test('YAML frontmatter: extracts name only', () => {
  const content = `---
name: Bug Fixer
---
Fix all bugs in the code.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Bug Fixer')
  assertEquals(result.description, null)
  assertEquals(result.prompt, 'Fix all bugs in the code.')
})

// Test 3: Markdown with title and description comment
test('Markdown: extracts title and description comment', () => {
  const content = `# Code Review Prompt
<!-- Description: Review code for best practices -->
Please review the following code carefully.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Code Review Prompt')
  assertEquals(result.description, 'Review code for best practices')
  assertEquals(result.prompt, 'Please review the following code carefully.')
})

// Test 4: Markdown with title only
test('Markdown: extracts title only', () => {
  const content = `# Bug Fixer
Fix all bugs in the code.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Bug Fixer')
  assertEquals(result.description, null)
  assertEquals(result.prompt, 'Fix all bugs in the code.')
})

// Test 5: Plain text (fallback to URL filename)
test('Plain text: extracts name from URL filename', () => {
  const content = `This is a plain text prompt without any metadata.`

  const result = parseSkillFile(content, 'https://example.com/code-review.md')

  assertEquals(result.name, 'code review')
  assertEquals(result.description, null)
  assertEquals(result.prompt, 'This is a plain text prompt without any metadata.')
})

// Test 6: Plain text with different file extensions
test('Plain text: handles different file extensions', () => {
  const content = `Plain text content.`

  const result1 = parseSkillFile(content, 'https://example.com/test.txt')
  assertEquals(result1.name, 'test')

  const result2 = parseSkillFile(content, 'https://example.com/test.yaml')
  assertEquals(result2.name, 'test')

  const result3 = parseSkillFile(content, 'https://example.com/test.yml')
  assertEquals(result3.name, 'test')
})

// Test 7: URL filename with hyphens and underscores
test('Plain text: converts hyphens and underscores to spaces', () => {
  const content = `Plain text content.`

  const result = parseSkillFile(content, 'https://example.com/my-awesome_skill.md')

  assertEquals(result.name, 'my awesome skill')
})

// Test 8: Invalid YAML frontmatter (fallback to Markdown)
test('Invalid YAML: falls back to Markdown parsing', () => {
  const content = `# Fallback Title
Content here.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  // Should use Markdown parsing
  assertEquals(result.name, 'Fallback Title')
})

// Test 9: Empty content after frontmatter
test('YAML frontmatter: handles empty prompt content', () => {
  const content = `---
name: Empty Prompt
description: Test empty
---
`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Empty Prompt')
  assertEquals(result.description, 'Test empty')
  // Should fallback to original content when prompt is empty
  assertEquals(result.prompt.includes('name: Empty Prompt'), true)
})

// Test 10: Whitespace handling
test('Whitespace: trims name and description', () => {
  const content = `---
name:   Code Review
description:   Review code
---
  Prompt content  `

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Code Review')
  assertEquals(result.description, 'Review code')
  assertEquals(result.prompt, 'Prompt content')
})

// Test 11: URL without filename
test('Plain text: handles URL without filename', () => {
  const content = `Plain text content.`

  const result = parseSkillFile(content, 'https://example.com/')

  assertEquals(result.name, 'Untitled')
})

// Test 12: Invalid URL
test('Plain text: handles invalid URL', () => {
  const content = `Plain text content.`

  const result = parseSkillFile(content, 'not-a-valid-url')

  assertEquals(result.name, 'Untitled')
})

// Test 13: Complex Markdown with multiple headers
test('Markdown: uses first header only', () => {
  const content = `# First Header
## Second Header
Content here.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'First Header')
  assertEquals(result.prompt.includes('## Second Header'), true)
})

// Test 14: YAML frontmatter with extra fields
test('YAML frontmatter: ignores extra fields', () => {
  const content = `---
name: Test
description: Test desc
author: John Doe
version: 1.0
---
Prompt content.`

  const result = parseSkillFile(content, 'https://example.com/test.md')

  assertEquals(result.name, 'Test')
  assertEquals(result.description, 'Test desc')
  assertEquals(result.prompt, 'Prompt content.')
})

console.log('\n=== All tests completed ===\n')
