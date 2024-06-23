import React, { PropsWithChildren } from 'react';
type TagVariant = 'green' | 'red' | 'yellow' | 'blue' | 'grey' | 'transparent';
type TagSpacing = 'medium';
type TagProps = {
    readonly variant?: TagVariant;
    readonly title?: string;
    readonly spacing?: TagSpacing;
};
export declare const Tag: React.FC<PropsWithChildren<TagProps>>;
export declare const TagLabel: React.FC<PropsWithChildren<{}>>;
export {};
