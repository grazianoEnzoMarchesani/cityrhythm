"""Estrae i 210 termini del polinomio UTCI (Broede et al. 2012) dal codice di
pythermalcomfort e scrive src/compass/utci-coeff.js per la versione JS.

Uso: .venv/bin/pip install --no-deps pythermalcomfort   (serve solo il sorgente: senza --no-deps
     abbassa numpy sotto la versione richiesta da pandas e i calcoli si corrompono)
     .venv/bin/python genera_utci.py
Ogni termine e' [coefficiente, potenza di Ta, di v10, di (Tmrt - Ta), di pa].
Il polinomio si valuta con numpy (utci_poly). Verifica: valori di riferimento della
documentazione di pythermalcomfort.
"""
import ast, importlib.util, json, os
import numpy as np

VARS = ["tdb", "v", "delta_t_tr", "pa"]
HERE = os.path.dirname(os.path.abspath(__file__))


def termini():
    # si legge solo il testo del sorgente: pythermalcomfort non va importato (numba vuole numpy < 2.3)
    pkg = importlib.util.find_spec("pythermalcomfort").submodule_search_locations[0]
    src = open(os.path.join(pkg, "models", "utci.py")).read()
    fn = next(n for n in ast.walk(ast.parse(src)) if isinstance(n, ast.FunctionDef) and n.name == "_utci_optimized")
    expr = next(n for n in ast.walk(fn) if isinstance(n, ast.Return)).value

    def addendi(node, sign=1):
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub)):
            yield from addendi(node.left, sign)
            yield from addendi(node.right, sign if isinstance(node.op, ast.Add) else -sign)
        else:
            yield sign, node

    def fattori(node):
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
            yield from fattori(node.left)
            yield from fattori(node.right)
        else:
            yield node

    out = []
    for sign, node in addendi(expr):
        coef, pot = float(sign), [0, 0, 0, 0]
        for f in fattori(node):
            if isinstance(f, ast.Name):
                pot[VARS.index(f.id)] += 1
            else:
                coef *= eval(compile(ast.Expression(f), "utci", "eval"))
        out.append([coef, *pot])
    return out


TERMINI = np.array(termini())


def utci_poly(tdb, v, dtr, pa):
    """Polinomio UTCI con numpy, a blocchi per non esaurire la memoria."""
    shape = np.broadcast(tdb, v, dtr, pa).shape
    x = [np.broadcast_to(a, shape).ravel() for a in (tdb, v, dtr, pa)]
    out = np.empty(x[0].size)
    for s in range(0, out.size, 200_000):
        pw = [np.stack([xi[s:s + 200_000] ** k for k in range(7)]) for xi in x]
        acc = np.zeros(pw[0].shape[1])
        for c, i, j, k, l in TERMINI:
            acc += c * pw[0][int(i)] * pw[1][int(j)] * pw[2][int(k)] * pw[3][int(l)]
        out[s:s + 200_000] = acc
    return out.reshape(shape)


if __name__ == "__main__":
    # utci(tdb=25, tr=25, v=1.0, rh=50) = 24.6 (esempio della documentazione di pythermalcomfort)
    pa = 6.112 * np.exp(17.62 * 25 / (243.12 + 25)) * 0.5 / 10
    print(f"{len(TERMINI)} termini; prova: UTCI(25 °C, Tmrt 25, v 1 m/s, UR 50%) = {float(utci_poly(25.0, 1.0, 0.0, pa)):.1f} (atteso 24.6)")
    js = os.path.join(HERE, "..", "src", "compass", "utci-coeff.js")
    with open(js, "w") as f:
        f.write("// Generato da sound-lab/genera_utci.py: polinomio UTCI (Broede et al. 2012) da pythermalcomfort.\n"
                "// Ogni termine: [coefficiente, potenza di Ta, di v10, di (Tmrt - Ta), di pa (kPa)].\n"
                "export const UTCI_TERMS = " + json.dumps(TERMINI.tolist()).replace("], [", "],\n[") + ";\n")
    print("scritto", os.path.relpath(js))
