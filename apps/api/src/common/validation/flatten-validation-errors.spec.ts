import { ValidationError } from 'class-validator';
import { flattenValidationErrors } from './flatten-validation-errors';

const erro = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
) => ({ property, constraints, children }) as ValidationError;

describe('flattenValidationErrors', () => {
  it('achata um erro simples', () => {
    const resultado = flattenValidationErrors([
      erro('email', { isEmail: 'email deve ser válido' }),
    ]);

    expect(resultado).toEqual([{ field: 'email', message: 'email deve ser válido' }]);
  });

  it('devolve uma entrada por constraint violada no mesmo campo', () => {
    const resultado = flattenValidationErrors([
      erro('password', { minLength: 'mínimo de 8 caracteres', matches: 'precisa de um número' }),
    ]);

    expect(resultado).toHaveLength(2);
    expect(resultado.map((e) => e.field)).toEqual(['password', 'password']);
  });

  it('monta o caminho em notação de ponto para erro aninhado', () => {
    const resultado = flattenValidationErrors([
      erro('address', undefined, [erro('zipCode', { isPostalCode: 'CEP inválido' })]),
    ]);

    expect(resultado).toEqual([{ field: 'address.zipCode', message: 'CEP inválido' }]);
  });

  it('desce mais de um nível', () => {
    const resultado = flattenValidationErrors([
      erro('student', undefined, [
        erro('address', undefined, [erro('city', { isString: 'cidade é obrigatória' })]),
      ]),
    ]);

    expect(resultado[0]?.field).toBe('student.address.city');
  });

  it('mantém o erro do nó pai quando ele também tem filhos', () => {
    const resultado = flattenValidationErrors([
      erro('address', { isObject: 'endereço é obrigatório' }, [
        erro('zipCode', { isPostalCode: 'CEP inválido' }),
      ]),
    ]);

    expect(resultado).toEqual([
      { field: 'address', message: 'endereço é obrigatório' },
      { field: 'address.zipCode', message: 'CEP inválido' },
    ]);
  });

  it('devolve lista vazia quando não há constraint', () => {
    expect(flattenValidationErrors([])).toEqual([]);
    expect(flattenValidationErrors([erro('campo')])).toEqual([]);
  });
});
