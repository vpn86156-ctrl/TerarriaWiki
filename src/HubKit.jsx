import React from 'react';
import {ArrowRight,Info} from 'lucide-react';
import {VERSION} from './expeditionData';
export const assetPath=id=>`${import.meta.env.BASE_URL}assets/${id}.webp`;
export function Pixel({id,alt='',...rest}){return <img className="sprite" src={assetPath(id)} alt={alt} {...rest}/>}
export function ToolHeading({tag,title,text}){return <header className="tool-heading"><span className="eyebrow">{tag}</span><h2>{title}</h2><p>{text}</p><small>{VERSION} · данные вводятся вручную</small></header>}
export function Note({children}){return <div className="exp-note"><Info size={17}/><p>{children}</p></div>}
export function Jump({children,onClick}){return <button className="exp-jump" onClick={onClick}>{children}<ArrowRight size={14}/></button>}
export function Field({label,children}){const id=React.useId();return <label className="exp-field"><span id={id}>{label}</span>{React.isValidElement(children)?React.cloneElement(children,{'aria-labelledby':id}):children}</label>}
export function Panel({title,children,className=''}){return <section className={`exp-panel ${className}`}>{title&&<h3>{title}</h3>}{children}</section>}
