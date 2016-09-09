import json
import editdistance
from collections import OrderedDict
from itertools import combinations
import numpy as np


def pairwise_distances(data_list):
    dim = len(data_list)
    distances = np.zeros((dim * (dim-1))/2)

    counter = 0
    for combo in combinations(range(dim), 2):
        if counter < len(distances):
            distances[counter] = editdistance.eval(data_list[combo[0]], data_list[combo[1]])
        counter += 1

    return distances


dictionary_fp = "./dictionary-interm2.json"
with open(dictionary_fp, 'rb') as dict_file:
    dictionary = json.load(dict_file, object_pairs_hook=OrderedDict)
    array = pairwise_distances(dictionary.keys())
    json.dump(dictionary, open("./ordered-dictionary.json", "wb"))
    np.save(open("./distance-matrix.npy", "wb"), array)

# TODO actual clustering