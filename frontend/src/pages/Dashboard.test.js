import { describe, it, expect } from 'vitest';
import { renamedResumes, withoutResume } from './Dashboard';

const list = [
  { resume_id: '1', title: 'Old', updated_at: 'a' },
  { resume_id: '2', title: 'Keep', updated_at: 'b' },
];

describe('renamedResumes', () => {
  it('updates the title and timestamp of the matching resume only', () => {
    const result = renamedResumes(list, { resume_id: '1' }, { title: 'New', updated_at: 'z' });
    expect(result[0]).toMatchObject({ resume_id: '1', title: 'New', updated_at: 'z' });
    expect(result[1]).toEqual(list[1]);
  });

  it('falls back to the existing timestamp when none is supplied', () => {
    const result = renamedResumes(list, { resume_id: '1' }, { title: 'New' });
    expect(result[0].updated_at).toBe('a');
  });
});

describe('withoutResume', () => {
  it('removes the resume with the given id', () => {
    expect(withoutResume(list, '1')).toEqual([list[1]]);
  });
});
