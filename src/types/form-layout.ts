export type FieldWidget = "auto" | "input" | "textarea" | "wysiwyg";

export type FormElementField = {
  type: "field";
  fieldSlug: string;
  width: "full" | "half";
  widget?: FieldWidget;
};

export type FormElementNote = {
  type: "note";
  text: string;
};

export type FormElementButton = {
  type: "button";
  label: string;
  url: string;
};

export type FormElementDivider = {
  type: "divider";
};

export type FormElementTabGroup = {
  type: "tab-group";
  tabs: FormTab[];
};

export type FormElement =
  | FormElementField
  | FormElementNote
  | FormElementButton
  | FormElementDivider
  | FormElementTabGroup;

export type FormTab = {
  id: string;
  label: string;
  elements: FormElement[];
};

export type FormLayout = {
  tabs: FormTab[];
};
