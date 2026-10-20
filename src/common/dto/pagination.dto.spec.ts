import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { paginate, PaginationQueryDto } from './pagination.dto';

describe('PaginationQueryDto / paginate', () => {
  it('aplica valores por defecto y calcula skip/take', () => {
    const query = plainToInstance(PaginationQueryDto, { page: '3', pageSize: '10' });
    expect(validateSync(query)).toHaveLength(0);
    expect(query.skip).toBe(20);
    expect(query.take).toBe(10);
    const defaults = plainToInstance(PaginationQueryDto, {});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(20);
  });

  it('rechaza pageSize mayor al máximo', () => {
    const query = plainToInstance(PaginationQueryDto, { pageSize: '1000' });
    expect(validateSync(query).map((e) => e.property)).toContain('pageSize');
  });

  it('paginate arma { data, meta }', () => {
    expect(paginate(['a', 'b'], 57, { page: 1, pageSize: 20 })).toEqual({
      data: ['a', 'b'],
      meta: { page: 1, pageSize: 20, total: 57, totalPages: 3 },
    });
  });
});
