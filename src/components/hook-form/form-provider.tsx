import type { FieldValues, UseFormReturn } from "react-hook-form";
import { FormProvider as HookFormProvider } from "react-hook-form";

export type FormProps<TFieldValues extends FieldValues = FieldValues> = Omit<
  React.ComponentPropsWithoutRef<"form">,
  "onSubmit"
> & {
  methods: UseFormReturn<TFieldValues>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  children: React.ReactNode;
};

export function Form<TFieldValues extends FieldValues = FieldValues>({
  methods,
  onSubmit,
  children,
  ...formProps
}: FormProps<TFieldValues>) {
  return (
    <HookFormProvider {...methods}>
      <form noValidate autoComplete="off" onSubmit={onSubmit} {...formProps}>
        {children}
      </form>
    </HookFormProvider>
  );
}
