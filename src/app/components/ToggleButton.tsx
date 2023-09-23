// Copyright 2023 Bennett McElwee. All rights reserved.

interface ToggleButtonProps extends Omit<React.ComponentProps<'button'>, 'value'> {
    value: boolean
}

const ToggleButton = ({ children, className, value, ...props }: ToggleButtonProps) => (
    <button
        className={`inline-block w-10 min-w-fit whitespace-nowrap ${value ? '' : 'dimmed'} ${props.disabled ? 'opacity-50' : ''}`}
        {...props}
    >
        {children}
    </button>
)

export default ToggleButton
