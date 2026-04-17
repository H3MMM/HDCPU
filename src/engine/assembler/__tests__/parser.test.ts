import { describe, expect, it } from 'vitest';
import { Lexer } from '../lexer';
import { Parser } from '../parser';

describe('Parser', () => {
  const lexer = new Lexer();
  const parser = new Parser();

  it('should parse labels and representative operands', () => {
    const program = parser.parse(lexer.tokenize(`
loop:
  add x1, x2, x3
  sw x1, 8(x0)
  beq x1, x0, loop
`));

    expect(program.statements).toHaveLength(3);
    expect(program.statements[0].labels[0].name).toBe('loop');
    expect(program.statements[0].instruction?.mnemonic).toBe('add');
    expect(program.statements[0].instruction?.operands[0]).toMatchObject({ type: 'register', name: 'x1' });
    expect(program.statements[1].instruction?.operands[1]).toMatchObject({ type: 'memory', offset: 8, base: 'x0' });
    expect(program.statements[2].instruction?.operands[2]).toMatchObject({ type: 'label', name: 'loop' });
  });
});
