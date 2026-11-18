import {expect,it} from 'vitest';
import {normalize} from '../src/model';
it('anonymizes out-of-team IDs in issue fields and relationship keys',()=>{
  const item = {kind:'issue' as const,id:'a',teamId:'team',title:'A',parentId:'outside-parent',projectId:'outside-project'};
  const graph=normalize([item],[{id:'x',source:'outside-blocker',target:'a',kind:'blocks'}],[],'team');
  expect(JSON.stringify(graph)).not.toContain('outside-');
  expect(graph.links.filter(e=>e.kind==='blocks')).toHaveLength(1);
  expect(item.parentId).toBe('outside-parent');
});
