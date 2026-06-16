export type ActivationName = 'sigmoid' | 'tanh' | 'relu' | 'leakyRelu' | 'linear';

export interface ActivationSpec {
  name: ActivationName;
  label: string;
  apply: (value: number) => number;
  range: { min: number; max: number };
}

const sigmoid = (value: number): number => 1 / (1 + Math.exp(-value));

const tanh = (value: number): number => Math.tanh(value);

const relu = (value: number): number => Math.max(0, value);

const leakyRelu = (value: number): number => (value >= 0 ? value : 0.1 * value);

const linear = (value: number): number => value;

export const activationSpecs: Record<ActivationName, ActivationSpec> = {
  sigmoid: { name: 'sigmoid', label: 'Сигмоида', apply: sigmoid, range: { min: 0, max: 1 } },
  tanh: { name: 'tanh', label: 'Гиперболический тангенс', apply: tanh, range: { min: -1, max: 1 } },
  relu: { name: 'relu', label: 'ReLU', apply: relu, range: { min: 0, max: 4 } },
  leakyRelu: {
    name: 'leakyRelu',
    label: 'Leaky ReLU',
    apply: leakyRelu,
    range: { min: -0.5, max: 4 },
  },
  linear: { name: 'linear', label: 'Линейная', apply: linear, range: { min: -4, max: 4 } },
};

export const softmax = (values: number[]): number[] => {
  if (values.length === 0) return [];
  const peak = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - peak));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => 0);
  return exponentials.map((value) => value / total);
};
