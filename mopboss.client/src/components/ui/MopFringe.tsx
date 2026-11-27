import styles from './MopFringe.module.css';

/** Scalloped mop-fringe edge that closes every black section. Place inside a positioned section. */
export function MopFringe() {
  return <div className={styles.fringe} aria-hidden="true" />;
}
