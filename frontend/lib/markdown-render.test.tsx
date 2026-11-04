import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

function View({ content }: { content: string }) {
  return (
    <div data-testid="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

describe('chat answer rendering', () => {
  it('renders GFM tables and headings without raw Markdown symbols', () => {
    render(<View content={'## Policy\n\n| A | B |\n| --- | --- |\n| 1 | 2 |'} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Policy')
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByTestId('md').textContent).not.toContain('##')
    expect(screen.getByTestId('md').textContent).not.toContain('| --- |')
  })

  it('strips raw HTML/scripts from templates and answers', () => {
    const { container } = render(
      <View content={'Hello <script>window.evil = 1</script> <img src="x" onerror="bad()" />'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Hello')
  })

  it('renders checkboxes and lists from GFM task lists', () => {
    render(<View content={'- [ ] First Half\n- [x] Approved'} />)
    expect(screen.getAllByRole('checkbox').length).toBe(2)
  })
})
