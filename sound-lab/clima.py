"""Stress termico percepito per cella (UTCI), versione di riferimento della bussola.

Ogni passo usa una relazione pubblicata; i numeri stanno in bussola.json ("fisica").
1. Aria della cella = aria della stazione (Open-Meteo) + isola di calore notturna nelle
   sole celle costruite (LCZ 1-10):
     massimo per geometria   dT = 15.27 - 13.88 * SVF            (Oke 1981, canyon e SVF)
     tetto per una citta' di P abitanti  2.01 log10(P) - 4.06       (Oke 1973, citta' europee)
     x vento   min(1, U^-1/2)                                       (Oke: dT ~ U^-1/2)
     x nuvole  rapporto fra perdita infrarossa reale e a cielo sereno (bilancio radiativo)
   Di giorno l'isola di calore dell'aria e' debole (Oke 1982): conta il sole sul corpo (punto 2).
2. Temperatura media radiante (Tmrt) di una persona in piedi, come in RayMan/VDI 3787:
     Tmrt = [ (1/sigma) sum Fi (Li + ak/ep Di) + fp ak I* / (ep sigma) ]^1/4 - 273.15
   - sole diretto I* = DNI x quota di strada al sole; la strada e' un canyon con H/W
     ricavato dallo SVF (SVF = cos(arctan(2 H/W))), mediato su tutte le orientazioni;
   - fp = fattore di proiezione del corpo (Jendritzky);
   - cielo diffuso pesato con lo SVF, luce riflessa dal suolo con l'albedo della cella;
   - infrarosso del cielo: emissivita' di Brutsaert (sereno) e Crawford & Duchon (nuvole);
     suolo e muri emettono alla temperatura dell'aria (semplificazione: niente suolo rovente).
3. Vento: da 10 m sulla stazione a 10 m sulla cella con il metodo dell'altezza di
   miscelamento (Wieringa; guida WMO n. 8), usando la rugosita' z0 della cella.
4. UTCI con il polinomio ufficiale (Broede et al. 2012), coefficienti da pythermalcomfort
   (vedi genera_utci.py).
"""
import numpy as np
from genera_utci import utci_poly

SIGMA = 5.67e-8


def vapour_hpa(t):
    """Pressione di vapore saturo (hPa), formula di Magnus."""
    return 6.112 * np.exp(17.62 * t / (243.12 + t))


def sky_emissivity(t, e_hpa, cloud):
    clear = 1.24 * (e_hpa / (t + 273.15)) ** (1 / 7)  # Brutsaert 1975
    return clear, cloud + (1 - cloud) * clear          # Crawford & Duchon 1999


def clima(F, *, ta, rh, cloud_pct, wind_kmh, dni, dir_h, dif_h, sun, svf, albedo, z0, costruita):
    """Tutti gli argomenti sono array (si combinano per broadcast). Restituisce UTCI, Tmrt, aria."""
    cloud = cloud_pct / 100
    u10 = np.maximum(wind_kmh / 3.6, 0.1)
    e = vapour_hpa(ta) * rh / 100
    clear, eps_sky = sky_emissivity(ta, e, cloud)

    # 1. aria della cella
    dt_max = np.minimum(np.maximum(15.27 - 13.88 * svf, 0), 2.01 * np.log10(F["popolazione"]) - 4.06)
    phi_cloud = np.clip((F["eps_superfici"] - eps_sky) / (F["eps_superfici"] - clear), 0, 1)
    dt = np.where((sun < 0) & costruita, dt_max * np.minimum(1, u10 ** -0.5) * phi_cloud, 0)
    t_cell = ta + dt
    rh_cell = np.clip(100 * e / vapour_hpa(t_cell), 0, 100)

    # 2. Tmrt
    beta = np.radians(np.maximum(sun, 0))
    hw = np.tan(np.arccos(np.clip(svf, 0.01, 1))) / 2
    f_sun = np.where(sun > 0, np.clip(1 - (2 / np.pi) * hw / np.maximum(np.tan(beta), 1e-3), 0, 1), 0)
    s = np.maximum(sun, 0)
    fp = 0.308 * np.cos(np.radians(s * (0.998 - s * s / 50000)))
    l_sky = eps_sky * SIGMA * (ta + 273.15) ** 4
    l_surf = F["eps_superfici"] * SIGMA * (t_cell + 273.15) ** 4
    l_up = svf * l_sky + (1 - svf) * l_surf
    d_up = svf * dif_h
    d_down = albedo * (dir_h * f_sun + dif_h * svf)
    ak, ep = F["ak"], F["ep"]
    sum_fi = (0.06 * (l_up + ak / ep * d_up) + 0.06 * (l_surf + ak / ep * d_down)
              + 0.88 * (0.5 * (l_up + l_surf) + ak / ep * 0.5 * (d_up + d_down)))
    tmrt = (sum_fi / SIGMA + fp * ak * dni * f_sun / (ep * SIGMA)) ** 0.25 - 273.15

    # 3. vento
    z0s, zb = F["z0_stazione"], F["altezza_miscelamento_m"]
    v10 = u10 * np.log(zb / z0s) / np.log(10 / z0s) * np.log(10 / z0) / np.log(zb / z0)

    # 4. UTCI (fuori dai limiti del polinomio gli ingressi vengono riportati al bordo)
    t_c = np.clip(t_cell, -50, 50)
    utci = utci_poly(t_c, np.clip(v10, 0.5, 17), np.clip(tmrt - t_c, -30, 70),
                           vapour_hpa(t_c) * rh_cell / 100 / 10)
    return utci, tmrt, t_cell


def comfort(utci, F):
    """+1 senza stress termico (9-26 °C UTCI), -1 dove inizia lo stress forte (32 °C caldo, -13 °C freddo)."""
    c0, c1 = F["utci_nessuno_stress"]
    hot, cold = F["utci_stress_forte_caldo"], F["utci_stress_forte_freddo"]
    c = np.where(utci > c1, 1 - 2 * (utci - c1) / (hot - c1),
        np.where(utci < c0, 1 - 2 * (c0 - utci) / (c0 - cold), 1.0))
    return np.clip(c, -1, 1)
