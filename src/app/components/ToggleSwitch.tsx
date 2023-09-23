// Copyright 2023 Bennett McElwee. All rights reserved.
interface ToggleSwitchProps {
    disabled: boolean,
    id: string,
    label: string,
    name: string,
    onChange: React.ChangeEventHandler<HTMLInputElement>,
    value: boolean,
}
const ToggleSwitch = ({ disabled, id, label, name, onChange, value }: ToggleSwitchProps) => (
    <span className="flex items-center gap-2">
        <label htmlFor={id} className={`inline-block relative h-7 w-11 rounded-full border-2 ${
            value ? 'border-green-700 dark:border-gray-200' : 'border-gray-400 dark:border-gray-500'
        } ${
            disabled ? 'opacity-50' : 'cursor-pointer'
        }`}>
            {/* input */}
            <input className="peer sr-only"
                name={name} id={id} type="checkbox" checked={value ?? false} onChange={onChange}
                disabled={disabled}
            />
            {/* background */}
            <span
                className="absolute inset-0 rounded-full transition bg-gray-400 dark:bg-gray-900 peer-checked:bg-green-700"
            ></span>
            {/* switch */}
            <span
                className="absolute inset-y-0 start-0 m-1 h-4 w-4 rounded-full bg-white transition-all peer-checked:start-4"
            ></span>
        </label>
        <label htmlFor={id} className={`text-nowrap ${disabled ? '' : 'cursor-pointer'}`}>
            {label}
        </label>
    </span>
)

export default ToggleSwitch
