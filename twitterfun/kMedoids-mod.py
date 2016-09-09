import numpy as np
import math

'''
Using the condensed distance matrix format as used in scipy pdist
Only a triangular matrix is kept in a vector, here we take the upper triangular matrix

Vector = [dist(0,1), dist(0,2), ..., dist(0,n), dist(1,2) ...]

k-th combination from (n C 2), where n is matrix dimension, tells the row and column associated with Vector[k]

'''


def kMedoids(D, dim, k, tmax=100):

    # determine dimensions of distance matrix D
    m, n = D.shape

    # randomly initialize an array of k medoid indices
    M = np.sort(np.random.choice(dim, k))

    # create a copy of the array of medoid indices
    Mnew = np.copy(M)

    # initialize a dictionary to represent clusters
    C = {}
    for t in xrange(tmax):
        # determine clusters, i. e. arrays of data indices

        clust_assignments = {[] for i in range(len(M))}

        for medoid_index in M:
            from_index = square_to_condensed(medoid_index, 0, dim)
            to_index = square_to_condensed(medoid_index, dim, dim)

            assignment = np.amin(D[from_index:to_index])
            clust_assignments[medoid_index].append(assignment)
            clust_assignments.sort()

        # update cluster medoids
        for medoid_index in M:
            dist_indices = np.array([D[square_to_condensed(medoid_index, j, dim)] for j in C[medoid_index]])
            # TODO finish modifying this for the condensed matrix format
            mean = np.mean(D[dist_indices])
            j = np.argmin(mean)
            Mnew[medoid_index] = C[medoid_index][j]
        np.sort(Mnew)
        # check for convergence
        if np.array_equal(M, Mnew):
            break
        M = np.copy(Mnew)
    else:
        # final update of cluster memberships
        J = np.argmin(D[:,M], axis=1)
        for kappa in range(k):
            C[kappa] = np.where(J==kappa)[0]

    # return results
    return M, C


def condensed_index_to_row_col(index, dimension):
    # http://stackoverflow.com/a/14839010
    b = 1 - 2 * dimension
    i = math.floor((-b - math.sqrt(b**2 - 8*index))/2)
    j = index + i*(b + i + 2)/2 + 1
    return int(i), int(j)


def square_to_condensed(i, j, n):
    # http: // stackoverflow.com / a / 36867493
    assert i != j, "no diagonal elements in condensed matrix"
    if i < j:
        i, j = j, i
    return n*j - j*(j+1)/2 + i - 1 - j