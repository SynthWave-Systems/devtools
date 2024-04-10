import { Factory } from '@/types'
import assert from 'assert'

/**
 * Helper type for argumentless factories a.k.a. tasks
 */
type Task<T> = Factory<[], T>

/**
 * Executes tasks in sequence, waiting for each one to finish before starting the next one
 *
 * Will resolve with the output of all tasks or reject with the first rejection.
 *
 * @param {Task<T>[]} tasks
 * @returns {Promise<T[]>}
 */
export const sequence = async <T>(tasks: Task<T>[]): Promise<T[]> => {
    const collector: T[] = []

    for (const task of tasks) {
        collector.push(await task())
    }

    return collector
}

/**
 * Executes tasks in parallel
 *
 * Will resolve with the output of all tasks or reject with the any rejection.
 *
 * @param {Task<T>[]} tasks
 * @returns {Promise<T[]>}
 */
export const parallel = async <T>(tasks: Task<T>[]): Promise<T[]> => await Promise.all(tasks.map((task) => task()))

/**
 * Maps the errors coming from a task. Errors thrown from the `toError`
 * callback will not be caught.
 *
 * ```
 * const functionThatMightThrow = () => sdk.getSomeAttribute()
 *
 * const result = await mapError(functionThatMightThrow, (error) => new Error(`Error produced: ${error}`))
 * ```
 *
 * @template T
 * @template E
 * @param {(error: unknown) => E} toError Error mapping function
 */
export const mapError = async <T, E = unknown>(task: Task<T>, toError: (error: unknown) => E): Promise<Awaited<T>> => {
    try {
        return await task()
    } catch (error: unknown) {
        throw toError(error)
    }
}

/**
 * Intercepts any errors coming from a task. The return value
 * of this call will be the return value of the task
 * and the rejected value will be the original erorr.
 *
 * Any errors or rejections from the `onError` callback will be caught
 * and the original error will be rethrown.
 *
 * ```
 * const functionThatMightThrow = () => sdk.getSomeAttribute()
 *
 * // With custom logging
 * const result = await tapError(functionThatMightThrow, (error) => console.error('Something went wrong:', error))
 *
 * // For lazy people
 * const result = await tapError(functionThatMightThrow, console.error)
 * ```
 *
 * @param {Factory<[error: unknown], void>} onError Synchronous or asynchronous error callback
 */
export const tapError = async <T>(task: Task<T>, onError: Factory<[error: unknown], void>): Promise<Awaited<T>> => {
    try {
        return await task()
    } catch (error: unknown) {
        try {
            await onError(error)
        } catch {
            // Ignore the error from the callback since the original error
            // is probably more informative
        }

        throw error
    }
}

/**
 * Executes tasks in a sequence until one resolves.
 *
 * Will resolve with the output of the first task that resolves
 * or reject with the last rejection.
 *
 * Will reject immediatelly if no tasks have been passed
 *
 * @param {Task<T>[]} tasks
 * @returns {Promise<T>}
 */
export const first = async <T>(tasks: Task<T>[]): Promise<T> => {
    assert(tasks.length !== 0, `Must have at least one task for first()`)

    let lastError: unknown

    for (const task of tasks) {
        try {
            return await task()
        } catch (error) {
            lastError = error
        }
    }

    throw lastError
}

/**
 * Helper utility for currying first() - creating a function
 * that behaves like first() but accepts arguments that will be passed to the factory functions
 *
 * @param {Factory<TInput, TOutput>[]} factories
 * @returns {Factory<TInput, TOutput>}
 */
export const firstFactory =
    <TInput extends unknown[], TOutput>(...factories: Factory<TInput, TOutput>[]): Factory<TInput, TOutput> =>
    async (...input) =>
        await first(factories.map((factory) => () => factory(...input)))
