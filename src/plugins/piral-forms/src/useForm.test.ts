/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import { describe, it, expect, vitest, beforeEach } from 'vitest';

vitest.mock('react');

(React as any).useState = vitest.fn((idOrFn) => [typeof idOrFn === 'function' ? idOrFn() : idOrFn]);
(React as any).useEffect = vitest.fn((cb) => cb());

const useGlobalState = vitest.fn();
const usePrompt = vitest.fn();
const setStateFake = vitest.fn();
const useAction = vitest.fn(() => setStateFake);

vitest.mock('piral-core', async () => ({
  ...(await vitest.importActual('piral-core') as any),
  useGlobalState,
  usePrompt,
  useAction,
}));

describe('Form Hook Module', () => {
  beforeEach(() => {
    setStateFake.mockReset();
  });

  it('Returns the current data and not changed initially', async () => {
    const { useForm } = await import('./useForm');

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {
          foo: {
            changed: false,
            currentData: {},
            initialData: {},
            submitting: false,
            error: undefined,
          },
        },
      }),
    );

    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit() {
        return Promise.resolve();
      },
      onChange: undefined,
      emptyData: {},
    };
    const { changed, submitting, formData } = useForm({}, undefined, options, 'foo');
    expect(changed).toBeFalsy();
    expect(submitting).toBeFalsy();
    expect(formData).toEqual({});
    expect(setStateFake.mock.calls[0][0].length).toBe(3);
  });

  it('Generates a new id if the old one is not provided', async () => {
    const { useForm } = await import('./useForm');

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit() {
        return Promise.resolve();
      },
      onChange: undefined,
      emptyData: {},
    };
    const { changed, submitting, formData } = useForm({}, undefined, options);
    expect(changed).toBeFalsy();
    expect(submitting).toBeFalsy();
    expect(formData).toEqual({});
    expect(setStateFake.mock.calls[0][0].length).toBe(36);
  });

  it('Submit with no changed data does nothing', async () => {
    const { useForm } = await import ('./useForm');
    const onSubmit = vitest.fn(() => Promise.resolve());

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit,
      onChange: undefined,
      emptyData: {},
    };
    const { changed, submitting, formData, submit } = useForm({}, undefined, options);
    submit();
    expect(changed).toBeFalsy();
    expect(submitting).toBeFalsy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(formData).toEqual({});
    expect(setStateFake.mock.calls[0][0].length).toBe(36);
  });

  it('Submit with changed data submits successfully', async () => {
    const { useForm } = await import ('./useForm');
    const onSubmit = vitest.fn(() => Promise.resolve());

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {
          foo: {
            changed: true,
            currentData: {
              a: 'foo',
            },
            initialData: {
              a: '',
            },
            submitting: false,
            error: undefined,
          },
        },
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit,
      onChange: undefined,
      emptyData: {},
    };
    const { changed, formData, submit } = useForm({}, undefined, options, 'foo');
    const preventDefault = vitest.fn();
    (submit as any)({ preventDefault });
    expect(changed).toBeTruthy();
    expect(preventDefault).toBeCalled();
    expect(onSubmit).toHaveBeenCalledWith({
      a: 'foo',
    });
    expect(formData).toEqual({
      a: 'foo',
    });
  });

  it('Submit with changed data running into an error', async () => {
    const { useForm } = await import('./useForm');
    const onSubmit = vitest.fn(() => Promise.reject('My error'));

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {
          foo: {
            changed: true,
            currentData: {
              a: 'foo',
            },
            initialData: {
              a: '',
            },
            submitting: false,
            error: undefined,
          },
        },
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit,
      onChange: undefined,
      emptyData: {},
    };
    const { changed, formData, submit } = useForm({}, undefined, options, 'foo');
    submit();
    expect(changed).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith({
      a: 'foo',
    });
    expect(formData).toEqual({
      a: 'foo',
    });
  });

  it('Sets new data on changeForm', async () => {
    const { useForm } = await import('./useForm');

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit() {
        return Promise.resolve();
      },
      onChange: undefined,
      emptyData: {},
    };
    const { changeForm } = useForm({}, undefined, options, 'id');
    changeForm({
      target: {
        name: 'foo',
        value: 'bar',
      },
    } as any);
    expect(setStateFake).toHaveBeenCalledTimes(2);
    expect(setStateFake).toHaveBeenNthCalledWith(
      2,
      'id',
      {
        active: true,
        currentData: {},
        initialData: {},
        changed: false,
        submitting: false,
        error: undefined,
      },
      {
        currentData: {
          foo: 'bar',
        },
        changed: true,
        error: undefined,
      },
    );
  });

  it('Sets new data on setFormData', async () => {
    const { useForm } = await import('./useForm');

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit() {
        return Promise.resolve();
      },
      onChange: undefined,
      emptyData: {},
    };
    const { setFormData } = useForm({}, undefined, options, 'id');
    setFormData({
      foo: 'a',
      bar: 'b',
    } as any);
    expect(setStateFake).toHaveBeenCalledTimes(2);
    expect(setStateFake).toHaveBeenNthCalledWith(
      2,
      'id',
      {
        active: true,
        currentData: {},
        initialData: {},
        changed: false,
        submitting: false,
        error: undefined,
      },
      {
        currentData: {
          foo: 'a',
          bar: 'b',
        },
        changed: true,
        error: undefined,
      },
    );
  });

  it('Resets changes to initial data', async () => {
    const { useForm } = await import('./useForm');

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {
          id: {
            active: true,
            changed: true,
            currentData: {
              a: 'foo',
            },
            initialData: {
              a: '',
            },
            submitting: false,
            error: undefined,
          },
        },
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onSubmit() {
        return Promise.resolve();
      },
      onChange: undefined,
      emptyData: {},
    };
    const { reset } = useForm({}, undefined, options, 'id');
    reset();
    expect(setStateFake).toHaveBeenCalledTimes(2);
    expect(setStateFake).toHaveBeenNthCalledWith(
      2,
      'id',
      {
        active: true,
        currentData: {
          a: 'foo',
        },
        initialData: {
          a: '',
        },
        changed: true,
        submitting: false,
        error: undefined,
      },
      {
        currentData: {
          a: '',
        },
        changed: false,
        error: undefined,
      },
    );
  });

  it('onChange should be triggered with full data set', async () => {
    const { useForm } = await import('./useForm');
    const onChange = vitest.fn((data) => Promise.resolve(data));

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {
          id: {
            active: true,
            changed: true,
            currentData: {
              a: 'foo',
            },
            initialData: {
              a: '',
            },
            submitting: false,
            error: undefined,
          },
        },
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onChange,
      onSubmit() {
        return Promise.resolve();
      },
      emptyData: {},
    };
    const { setFormData } = useForm({}, undefined, options, 'id');
    setFormData({ a: 'b' });
    expect(onChange).toHaveBeenCalledWith({ a: 'b' });
  });

  it('onChange which fails should be handled gracefully', async () => {
    const { useForm } = await import('./useForm');
    const onChange = vitest.fn((data) => Promise.reject('my error'));

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onChange,
      onSubmit() {
        return Promise.resolve();
      },
      emptyData: {},
    };
    const { setFormData } = useForm({}, undefined, options);
    setFormData({ a: 'b' });
    expect(onChange).toHaveBeenCalledWith({ a: 'b' });
  });

  it('cleanup sets active to false', async () => {
    const { useForm } = await import('./useForm');
    (React as any).useEffect = vitest.fn((cb) => cb()());

    useGlobalState.mockImplementation((select: any) =>
      select({
        forms: {},
      }),
    );
    const options = {
      wait: false,
      silent: false,
      message: '',
      onChange: undefined,
      onSubmit() {
        return Promise.resolve();
      },
      emptyData: {},
    };
    useForm({}, undefined, options, 'id');
    expect(setStateFake).toHaveBeenCalledTimes(2);
    expect(setStateFake).toHaveBeenNthCalledWith(
      2,
      'id',
      {
        active: true,
        changed: false,
        currentData: {},
        error: undefined,
        initialData: {},
        submitting: false,
      },
      { active: false },
    );
  });
});
