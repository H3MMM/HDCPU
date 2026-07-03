import { AssemblerSyntaxError, Token } from './lexer';

const ABI_REGISTER_ALIASES: Readonly<Record<string, number>> = {
  zero: 0, ra: 1, sp: 2, gp: 3, tp: 4,
  t0: 5, t1: 6, t2: 7,
  s0: 8, fp: 8, s1: 9,
  a0: 10, a1: 11, a2: 12, a3: 13, a4: 14, a5: 15, a6: 16, a7: 17,
  s2: 18, s3: 19, s4: 20, s5: 21, s6: 22, s7: 23, s8: 24, s9: 25, s10: 26, s11: 27,
  t3: 28, t4: 29, t5: 30, t6: 31,
};

export interface LabelNode {
  name: string;
  line: number;
  column: number;
}

export interface RegisterOperand {
  type: 'register';
  name: string;
  line: number;
  column: number;
}

export interface ImmediateOperand {
  type: 'immediate';
  value: number;
  line: number;
  column: number;
}

export interface LabelOperand {
  type: 'label';
  name: string;
  line: number;
  column: number;
}

export interface MemoryOperand {
  type: 'memory';
  offset: number;
  base: string;
  line: number;
  column: number;
}

export type Operand = RegisterOperand | ImmediateOperand | LabelOperand | MemoryOperand;

export interface InstructionNode {
  mnemonic: string;
  operands: Operand[];
  line: number;
  column: number;
}

export interface StatementNode {
  labels: LabelNode[];
  instruction: InstructionNode | null;
  line: number;
}

export interface ProgramNode {
  statements: StatementNode[];
}

/**
 * 汇编语法分析器
 */
export class Parser {
  private tokens: Token[] = [];
  private current = 0;

  parse(tokens: Token[]): ProgramNode {
    this.tokens = tokens;
    this.current = 0;

    const statements: StatementNode[] = [];

    while (!this.isAtEnd()) {
      this.skipNewlines();

      if (this.isAtEnd()) {
        break;
      }

      statements.push(this.parseStatement());
    }

    return { statements };
  }

  private parseStatement(): StatementNode {
    const labels: LabelNode[] = [];
    const line = this.peek().line;

    while (this.check('identifier') && this.checkNext('colon')) {
      const label = this.advance();
      this.advance();
      labels.push({ name: label.lexeme, line: label.line, column: label.column });
      this.skipNewlines();
    }

    if (this.check('newline') || this.check('eof')) {
      this.match('newline');
      return { labels, instruction: null, line };
    }

    const mnemonic = this.consume('identifier', '需要指令助记符');
    const operands: Operand[] = [];

    if (!this.check('newline') && !this.check('eof')) {
      operands.push(this.parseOperand());
      while (this.match('comma')) {
        operands.push(this.parseOperand());
      }
    }

    if (!this.check('newline') && !this.check('eof')) {
      throw new AssemblerSyntaxError('需要行结束符', this.peek().line, this.peek().column);
    }

    this.match('newline');

    return {
      labels,
      line,
      instruction: {
        mnemonic: mnemonic.lexeme.toLowerCase(),
        operands,
        line: mnemonic.line,
        column: mnemonic.column,
      },
    };
  }

  private parseOperand(): Operand {
    const token = this.peek();

    if (this.check('number') && this.checkNext('lparen')) {
      const offset = this.advance();
      this.advance();
      const base = this.consume('identifier', '需要基址寄存器');
      this.consume('rparen', '需要 ")" 结束内存操作数');

      return {
        type: 'memory',
        offset: offset.value ?? 0,
        base: this.resolveRegisterName(base.lexeme),
        line: offset.line,
        column: offset.column,
      };
    }

    if (this.match('number')) {
      return {
        type: 'immediate',
        value: token.value ?? 0,
        line: token.line,
        column: token.column,
      };
    }

    if (this.match('identifier')) {
      if (this.isRegisterName(token.lexeme)) {
        return {
          type: 'register',
          name: this.resolveRegisterName(token.lexeme),
          line: token.line,
          column: token.column,
        };
      }

      return {
        type: 'label',
        name: token.lexeme,
        line: token.line,
        column: token.column,
      };
    }

    throw new AssemblerSyntaxError('需要操作数', token.line, token.column);
  }

  private isRegisterName(name: string): boolean {
    if (/^x\d+$/i.test(name)) {
      return true;
    }
    return name.toLowerCase() in ABI_REGISTER_ALIASES;
  }

  private resolveRegisterName(name: string): string {
    if (/^x\d+$/i.test(name)) {
      return name.toLowerCase();
    }
    const index = ABI_REGISTER_ALIASES[name.toLowerCase()];
    return index !== undefined ? `x${index}` : name.toLowerCase();
  }

  private skipNewlines(): void {
    while (this.match('newline')) {
      // 跳过空行
    }
  }

  private match(type: Token['type']): boolean {
    if (!this.check(type)) {
      return false;
    }
    this.advance();
    return true;
  }

  private consume(type: Token['type'], message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw new AssemblerSyntaxError(message, token.line, token.column);
  }

  private check(type: Token['type']): boolean {
    if (this.isAtEnd()) {
      return type === 'eof';
    }
    return this.peek().type === type;
  }

  private checkNext(type: Token['type']): boolean {
    if (this.current + 1 >= this.tokens.length) {
      return false;
    }
    return this.tokens[this.current + 1].type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.tokens[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'eof';
  }

  private peek(): Token {
    return this.tokens[this.current];
  }
}
