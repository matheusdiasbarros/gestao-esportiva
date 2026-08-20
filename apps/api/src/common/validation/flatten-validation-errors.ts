import { ValidationError } from 'class-validator';
import type { ValidationError as ApiValidationError } from '@gestao/types';

/**
 * Achata os erros aninhados do class-validator no formato plano da API.
 *
 * O class-validator devolve uma árvore: `student.address.zipCode` vira três níveis. A API
 * expõe o caminho em notação de ponto, que é o que o front precisa para destacar o campo.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ApiValidationError[] {
  const result: ApiValidationError[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push({ field: path, message });
      }
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, path));
    }
  }

  return result;
}
