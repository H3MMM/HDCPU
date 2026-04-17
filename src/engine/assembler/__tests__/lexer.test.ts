import { describe, expect, it } from 'vitest';
import { Lexer } from '../lexer';

describe('Lexer', () => {
  const lexer = new Lexer();

  it('should tokenize labels, instructions, numbers, and memory operands', () => {
    const tokens = lexer.tokenize(`
start:
  addi x1, x0, 10 # load immediate
  lw x2, -4(x1)
`);

    const significantTokens = tokens
      .filter((token) => token.type !== 'newline' && token.type !== 'eof')
      .map((token) => [token.type, token.lexeme]);

    expect(significantTokens).toEqual([
      ['identifier', 'start'],
      ['colon', ':'],
      ['identifier', 'addi'],
      ['identifier', 'x1'],
      ['comma', ','],
      ['identifier', 'x0'],
      ['comma', ','],
      ['number', '10'],
      ['identifier', 'lw'],
      ['identifier', 'x2'],
      ['comma', ','],
      ['number', '-4'],
      ['lparen', '('],
      ['identifier', 'x1'],
      ['rparen', ')'],
    ]);
  });
});
