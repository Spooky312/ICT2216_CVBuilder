import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import Projects from './Projects';

const oneProject = [{
  name: 'Site', description: '', technologies: [], url: '', start_date: '', end_date: '',
}];

describe('Projects technologies parsing', () => {
  it('parses comma-separated technologies on change and blur', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Projects data={oneProject} onChange={onChange} onFieldBlur={vi.fn()} />
    );

    const input = container.querySelector('#project-0-technologies');
    fireEvent.change(input, { target: { value: 'Python, React ,  ' } });

    const changed = onChange.mock.calls.at(-1)[0];
    expect(changed[0].technologies).toEqual(['Python', 'React']);

    // Blur re-parses from the raw buffer.
    fireEvent.blur(input);
    const afterBlur = onChange.mock.calls.at(-1)[0];
    expect(afterBlur[0].technologies).toEqual(['Python', 'React']);
  });
});
