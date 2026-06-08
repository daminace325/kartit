export type AddressFields = {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country?: string | null;
};

type Props = {
    address: AddressFields;
    className?: string;
};

export default function AddressDisplay({ address, className }: Props) {
    const { name, phone, line1, line2, city, state, postalCode, country } =
        address;

    return (
        <div className={`text-sm text-slate-300${className ? ` ${className}` : ""}`}>
            <p className="font-medium text-white">{name}</p>
            <p className="text-slate-400">{phone}</p>
            <p className="mt-3">{line1}</p>
            {line2 && <p>{line2}</p>}
            <p>
                {city}
                {state ? `, ${state}` : ""} {postalCode}
            </p>
            {country && <p>{country}</p>}
        </div>
    );
}
