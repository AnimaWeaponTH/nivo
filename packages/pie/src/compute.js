/*
 * This file is part of the nivo project.
 *
 * Copyright 2016-present, Raphaël Benitte.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */
import {
    absoluteAngleRadians,
    absoluteAngleDegrees,
    midAngle,
    positionFromAngle,
    radiansToDegrees,
} from '@nivo/core'
import get from 'lodash/get'
import findIndex from 'lodash/findIndex'
import findLastIndex from 'lodash/findLastIndex'

export const computeRadialLabels = (arcs, props) => {
    const {
        getLabel,
        radius,
        skipAngle,
        linkOffset,
        linkDiagonalLength,
        linkHorizontalLength,
        textXOffset,
        textWidth,
        textHeight,
        disableOverlap,
    } = props
    const leftList = []
    const rightList = []
    let arcList = [...arcs]

    if (disableOverlap) {
        const forwardIndex = findIndex(arcs, arc => {
            const degree = getDegreeFromArc(arc)
            return degree < 90 || degree >= 270
        })

        if (forwardIndex > 0) {
            arcList = arcs.slice(forwardIndex).concat(arcs.slice(0, forwardIndex))
        } else {
            const backwardIndex = findLastIndex(arcs, arc => {
                const degree = getDegreeFromArc(arc)
                return !(degree < 90 || degree >= 270)
            })
            if (backwardIndex >= 0 && backwardIndex < arcs.length - 1) {
                arcList = arcs.slice(backwardIndex + 1).concat(arcs.slice(0, backwardIndex + 1))
            }
        }
    }

    const radialLabels = arcList
        .filter(arc => skipAngle === 0 || arc.angleDeg > skipAngle)
        .map(arc => {
            const angle = absoluteAngleRadians(midAngle(arc) - Math.PI / 2)
            const degree = absoluteAngleDegrees(radiansToDegrees(angle))
            const positionA = positionFromAngle(angle, radius + linkOffset)
            const positionB = positionFromAngle(angle, radius + linkOffset + linkDiagonalLength)

            let positionC
            let labelPosition
            let textAlign

            if (degree < 90 || degree >= 270) {
                positionC = { x: positionB.x + linkHorizontalLength, y: positionB.y }
                labelPosition = {
                    x: positionB.x + linkHorizontalLength + textXOffset,
                    y: positionB.y,
                    width: textWidth,
                    height: textHeight,
                }
                textAlign = 'left'
            } else {
                positionC = { x: positionB.x - linkHorizontalLength, y: positionB.y }
                labelPosition = {
                    x: positionB.x - linkHorizontalLength - textXOffset,
                    y: positionB.y,
                    width: textWidth,
                    height: textHeight,
                }
                textAlign = 'right'
            }

            const data = {
                isOverlap: false,
                degree,
                arc,
                text: getLabel(arc.data),
                position: labelPosition,
                align: textAlign,
                line: [positionA, positionB, positionC],
            }

            if (textAlign == 'left') {
                if (leftList.length > 0) {
                    data.isOverlap = isCollide(
                        leftList[leftList.length - 1].position,
                        data.position
                    )
                }
                leftList.push(data)
            } else {
                if (rightList.length > 0) {
                    data.isOverlap = isCollide(
                        rightList[rightList.length - 1].position,
                        data.position
                    )
                }
                rightList.push(data)
            }

            return data
        })

    if (disableOverlap) {
        const limitBottom = radius + linkOffset + linkDiagonalLength
        const limitTop = -limitBottom
        fixOverlapLabel(leftList, 1, limitBottom, props)
        fixOverlapLabel(rightList, -1, limitTop, props)
    }

    return radialLabels
}

function fixOverlapLabel(arcList, sign, limitY, props, endRecursive) {
    const { textHeight } = props
    let prevData
    let nextData
    let overLimit = 0
    let overlapList = []

    arcList.map(function(data, i, arr) {
        prevData = arr[i - 1]
        nextData = arr[i + 1]
        if (prevData && data.isOverlap) {
            data.position.y = prevData.position.y + (textHeight + 1) * sign
            data.line[2].y = prevData.line[2].y + (textHeight + 1) * sign
            fixOverlapPie(data, sign, props)
            if (nextData && !nextData.isOverlap) {
                nextData.isOverlap = isCollide(data.position, nextData.position)
            }
            overLimit = data.line[2].y - limitY - (endRecursive ? textHeight * sign * 0.5 : 0)
            overlapList.push(data)
        } else {
            overlapList = [data]
        }
        return data
    })

    if ((sign === 1 && overLimit > 0) || (sign === -1 && overLimit < 0)) {
        let index = overlapList.length - 1
        while (index >= 0) {
            const data = overlapList[index]
            data.position.y -= overLimit
            data.line[2].y -= overLimit
            fixOverlapPie(data, sign, props)
            index -= 1
        }

        if (!endRecursive) {
            let isOverlap = false
            let isFixAgain = false
            arcList.map(function(data, i, arr) {
                prevData = arr[i - 1]
                nextData = arr[i + 1]
                isOverlap = isCollide(
                    data.position,
                    get(prevData, 'position'),
                    get(nextData, 'position')
                )
                if (isOverlap) {
                    data.isOverlap = isOverlap
                    isFixAgain = true
                }
                return data
            })

            if (isFixAgain) {
                fixOverlapLabel(arcList, sign, limitY, props, true)
            }
        }
    }
}

export const fixOverlapPie = (data, sign, props) => {
    const { radius, textXOffset } = props
    const overlapOffset = 20
    const distance = getDistance(data.line[2].x, data.line[2].y, false)
    if (distance < radius + overlapOffset) {
        data.line[2].x = sign * getDistance(radius + overlapOffset, data.line[2].y, true)
        data.position.x = data.line[2].x + textXOffset * sign
    }
}

export const getDegreeFromArc = arc => {
    const angle = absoluteAngleRadians(midAngle(arc) - Math.PI / 2)
    return absoluteAngleDegrees(radiansToDegrees(angle))
}

export const getDistance = (x, y, isNegative) => {
    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) * (isNegative ? -1 : 1))
}

export const isCollide = (a, b, c) => {
    if (!a) {
        return false
    }
    const ab =
        !!b &&
        !(
            a.y + a.height < b.y ||
            a.y > b.y + b.height ||
            a.x + a.width < b.x ||
            a.x > b.x + b.width
        )
    const ac =
        !!c &&
        !(
            a.y + a.height < c.y ||
            a.y > c.y + c.height ||
            a.x + a.width < c.x ||
            a.x > c.x + c.width
        )
    return ab || ac
}
