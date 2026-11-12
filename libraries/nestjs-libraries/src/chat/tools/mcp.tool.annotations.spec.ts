import { readFileSync } from 'fs';
import { join } from 'path';

const toolsDir = __dirname;
const listSource = readFileSync(join(toolsDir, 'tool.list.ts'), 'utf8');

const registeredFiles = [...listSource.matchAll(/from '([^']+)'/g)].map((match) => {
  const imported = match[1];
  const file = imported.startsWith('.')
    ? imported
    : imported.replace('@gitroom/nestjs-libraries/chat/tools/', './');
  return file.endsWith('.ts') ? file : `${file}.ts`;
});

const annotationBlock = (source: string) => {
  const match = source.match(/annotations:\s*\{([\s\S]*?)\n\s*\}/);
  return match?.[1] || '';
};

describe('MCP tool annotations', () => {
  it('requires a title and read, destructive, and open-world hints on every registered tool', () => {
    expect(registeredFiles.length).toBeGreaterThan(0);
    const names: string[] = [];
    for (const file of registeredFiles) {
      const source = readFileSync(join(toolsDir, file), 'utf8');
      const name = source.match(/name = '([^']+)'/)?.[1] || file;
      names.push(name);
      const block = annotationBlock(source);
      for (const field of ['title:', 'readOnlyHint:', 'destructiveHint:', 'openWorldHint:']) {
        expect({ name, field, present: block.includes(field) }).toEqual({
          name,
          field,
          present: true,
        });
      }
      expect(block).toMatch(/title:\s*'[^']+'/);
    }

    expect(names).toEqual(
      expect.arrayContaining(['update_post', 'delete_post', 'generatePostsTool'])
    );
  });
});
