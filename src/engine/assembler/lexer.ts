export type TokenType =
  | 'identifier'
  | 'number'
  | 'comma'
  | 'colon'
  | 'lparen'
  | 'rparen'
  | 'newline'
  | 'eof';

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
  value?: number;
}

export class AssemblerSyntaxError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number
  ) {
    super(message);
    this.name = 'AssemblerSyntaxError';
  }
}

/**
 * 汇编词法分析器
 */
export class Lexer {
  tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let index = 0;
    let line = 1;
    let column = 1;

    while (index < source.length) {
      const current = source[index];

      if (current === '\r') {
        index += 1;
        continue;
      }

      if (current === '\n') {
        tokens.push({ type: 'newline', lexeme: '\n', line, column });
        index += 1;
        line += 1;
        column = 1;
        continue;
      }

      if (current === ' ' || current === '\t') {
        index += 1;
        column += 1;
        continue;
      }

      if (current === '#' || (current === '/' && source[index + 1] === '/')) {
        const commentLength = current === '#' ? 1 : 2;
        index += commentLength;
        column += commentLength;
        while (index < source.length && source[index] !== '\n') {
          index += 1;
          column += 1;
        }
        continue;
      }

      if (current === ',') {
        tokens.push({ type: 'comma', lexeme: current, line, column });
        index += 1;
        column += 1;
        continue;
      }

      if (current === ':') {
        tokens.push({ type: 'colon', lexeme: current, line, column });
        index += 1;
        column += 1;
        continue;
      }

      if (current === '(') {
        tokens.push({ type: 'lparen', lexeme: current, line, column });
        index += 1;
        column += 1;
        continue;
      }

      if (current === ')') {
        tokens.push({ type: 'rparen', lexeme: current, line, column });
        index += 1;
        column += 1;
        continue;
      }

      if (this.isNumberStart(source, index)) {
        const match = source
          .slice(index)
          .match(/^[+-]?(?:0[xX][0-9a-fA-F]+|\d+)/);

        if (!match) {
          throw new AssemblerSyntaxError('无效的数字字面量', line, column);
        }

        const lexeme = match[0];
        tokens.push({
          type: 'number',
          lexeme,
          line,
          column,
          value: this.parseNumber(lexeme),
        });

        index += lexeme.length;
        column += lexeme.length;
        continue;
      }

      if (this.isIdentifierStart(current)) {
        const match = source
          .slice(index)
          .match(/^[A-Za-z_.$][A-Za-z0-9_.$]*/);

        if (!match) {
          throw new AssemblerSyntaxError('无效的标识符', line, column);
        }

        const lexeme = match[0];
        tokens.push({ type: 'identifier', lexeme, line, column });
        index += lexeme.length;
        column += lexeme.length;
        continue;
      }

      throw new AssemblerSyntaxError(`意外的字符: ${current}`, line, column);
    }

    tokens.push({ type: 'eof', lexeme: '', line, column });
    return tokens;
  }

  private isIdentifierStart(char: string): boolean {
    return /[A-Za-z_.$]/.test(char);
  }

  private isNumberStart(source: string, index: number): boolean {
    const current = source[index];
    const next = source[index + 1];
    return /\d/.test(current) || ((current === '-' || current === '+') && /\d/.test(next ?? ''));
  }

  private parseNumber(lexeme: string): number {
    const sign = lexeme.startsWith('-') ? -1 : 1;
    const normalized = lexeme.startsWith('-') || lexeme.startsWith('+') ? lexeme.slice(1) : lexeme;

    if (normalized.startsWith('0x') || normalized.startsWith('0X')) {
      return sign * parseInt(normalized.slice(2), 16);
    }

    return sign * parseInt(normalized, 10);
  }
}
