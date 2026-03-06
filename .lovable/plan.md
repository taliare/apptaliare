

# Fix ApuracaoDialog Insert Mutation

Update the mutation in `src/components/t2/ApuracaoDialog.tsx` to:
1. Add `.select()` after `.insert()` to return inserted data
2. Add `console.error` logging on error
3. Add `console.log` on success
4. Destructure both `data` and `error` from the response

Single file change in the `mutationFn` block (lines ~48-60).

